"""
Prediction and real-time detection API endpoints.
"""

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.config import settings
from backend.services.inference_service import inference_service
from backend.database.models import AsyncSessionLocal, Prediction, Alert

router = APIRouter(prefix="/predict", tags=["Prediction"])


# ── Request schemas ───────────────────────────────────────────────────────────

class SinglePredictRequest(BaseModel):
    features: Dict[str, float]
    model_name: str = "random_forest"


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _store_prediction(pred: Dict, model_name: str, is_demo: bool = False):
    """Persist a prediction to the database and create an alert if malicious."""
    async with AsyncSessionLocal() as db:
        try:
            db_pred = Prediction(
                model_name=model_name,
                predicted_class=pred.get("predicted_class"),
                confidence=pred.get("confidence"),
                anomaly_score=pred.get("anomaly_score"),
                is_anomaly=pred.get("is_anomaly", False),
                risk_level=pred.get("risk_level", "NORMAL"),
                source_ip=pred.get("source_ip"),
                dest_ip=pred.get("dest_ip"),
                protocol=pred.get("protocol"),
                src_port=int(pred["src_port"]) if pred.get("src_port") and str(pred["src_port"]).isdigit() else None,
                dst_port=int(pred["dst_port"]) if pred.get("dst_port") and str(pred["dst_port"]).isdigit() else None,
                is_demo=is_demo,
            )
            db.add(db_pred)

            # Create alert for malicious traffic
            if pred.get("is_anomaly") or pred.get("predicted_class", "BENIGN") != "BENIGN":
                risk = pred.get("risk_level", "MEDIUM")
                if risk not in ("NORMAL",):
                    alert = Alert(
                        alert_type=pred.get("predicted_class", "ANOMALY"),
                        risk_level=risk,
                        model_name=model_name,
                        confidence=pred.get("confidence"),
                        anomaly_score=pred.get("anomaly_score"),
                        source_ip=pred.get("source_ip"),
                        dest_ip=pred.get("dest_ip"),
                        protocol=pred.get("protocol"),
                        description=(
                            f"Detected {pred.get('predicted_class', 'anomaly')} "
                            f"with confidence {pred.get('confidence', 0):.2%}"
                        ),
                        is_demo=is_demo,
                    )
                    db.add(alert)

            await db.commit()
        except Exception as exc:
            await db.rollback()
            # Non-fatal: log and continue
            import logging
            logging.getLogger(__name__).warning(f"DB store failed: {exc}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/batch")
async def predict_batch(
    file: UploadFile = File(...),
    model_name: str = Form(default="random_forest"),
    nrows: Optional[int] = Form(default=None),
    save_to_db: bool = Form(default=True),
):
    """
    Upload a CSV file and run batch predictions using the specified model.
    Returns structured predictions for every row.
    """
    # Validate
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    available = inference_service.available_models()
    if not available.get(model_name):
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' is not trained. Train it first.",
        )
    if not available.get("pipeline"):
        raise HTTPException(
            status_code=400,
            detail="Preprocessing pipeline not found. Upload and preprocess a dataset first.",
        )

    # Save upload
    contents = await file.read()
    save_path = settings.UPLOADS_DIR / f"pred_{uuid.uuid4().hex[:6]}_{file.filename}"
    save_path.write_bytes(contents)

    try:
        result = inference_service.predict_from_csv(save_path, model_name, nrows=nrows)

        if save_to_db:
            for pred in result["predictions"][:1000]:  # limit DB writes
                await _store_prediction(pred, model_name)

        return result
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    finally:
        save_path.unlink(missing_ok=True)


@router.post("/single")
async def predict_single(req: SinglePredictRequest):
    """
    Run a single prediction given a feature dictionary.
    Feature names must match those used during training.
    """
    available = inference_service.available_models()
    if not available.get(req.model_name):
        raise HTTPException(
            status_code=404,
            detail=f"Model '{req.model_name}' not trained.",
        )
    if not available.get("pipeline"):
        raise HTTPException(status_code=400, detail="No preprocessing pipeline found.")

    import numpy as np
    import pandas as pd
    pipeline = inference_service._load_pipeline()
    class_names = pipeline.get_label_names()

    # Build a 1-row DataFrame
    df = pd.DataFrame([req.features])
    try:
        X_scaled, _ = pipeline.transform(df)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Feature preprocessing failed: {exc}")

    try:
        preds = inference_service.predict_with_model(req.model_name, X_scaled, class_names)
        result = preds[0]
        await _store_prediction(result, req.model_name)
        return result
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/presets")
async def get_presets():
    """Return verified telemetry presets for testing different attack signatures."""
    presets_file = settings.DATA_DIR / "presets.json"
    if presets_file.exists():
        try:
            return json.loads(presets_file.read_text())
        except Exception:
            pass
    return {}


@router.post("/stream")
async def stream_predictions(
    file: UploadFile = File(...),
    model_name: str = Form(default="random_forest"),
    delay_ms: int = Form(default=100),
):
    """
    MODE A: CSV Stream Simulation.
    Streams predictions row-by-row as Server-Sent Events (SSE).
    This simulates real-time detection by processing flows sequentially.
    """
    available = inference_service.available_models()
    if not available.get(model_name):
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' not trained.",
        )

    contents = await file.read()
    save_path = settings.UPLOADS_DIR / f"stream_{uuid.uuid4().hex[:6]}_{file.filename}"
    save_path.write_bytes(contents)

    async def event_generator():
        try:
            delay_s = max(0, delay_ms) / 1000.0
            for pred in inference_service.stream_predictions(save_path, model_name):
                data = json.dumps(pred)
                yield f"data: {data}\n\n"
                if delay_s > 0:
                    await asyncio.sleep(delay_s)
            yield "data: {\"done\": true}\n\n"
        finally:
            save_path.unlink(missing_ok=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.websocket("/stream/{model_name}")
async def websocket_stream_predictions(websocket: WebSocket, model_name: str, fps: int = 5):
    """
    Simulates real-time detection by generating demo data and streaming it back.
    """
    await websocket.accept()
    available = inference_service.available_models()
    if not available.get(model_name):
        await websocket.close(code=1008, reason=f"Model '{model_name}' not trained.")
        return

    from backend.services.demo_data import get_or_create_demo_csv
    demo_path = get_or_create_demo_csv(1000)
    delay_s = max(0.1, 1.0 / fps) if fps > 0 else 0.2

    try:
        for pred in inference_service.stream_predictions(demo_path, model_name):
            await _store_prediction(pred, model_name, is_demo=True)
            await websocket.send_text(json.dumps(pred))
            await asyncio.sleep(delay_s)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Websocket error: {e}")
        try:
            await websocket.close()
        except:
            pass

