"""
Model training API endpoints.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config import settings
from backend.services.training_service import training_service, get_job, list_jobs, get_cached_data
from backend.services.inference_service import inference_service

router = APIRouter(prefix="/models", tags=["Models"])


# ── Request schemas ───────────────────────────────────────────────────────────

class RFTrainRequest(BaseModel):
    n_estimators: int = Field(default=100, ge=10, le=1000)
    max_depth: Optional[int] = Field(default=None, ge=1, le=50)
    min_samples_split: int = Field(default=2, ge=2, le=20)
    min_samples_leaf: int = Field(default=1, ge=1, le=10)


class LSTMTrainRequest(BaseModel):
    sequence_length: int = Field(default=10, ge=2, le=50)
    units: int = Field(default=64, ge=16, le=256)
    epochs: int = Field(default=20, ge=1, le=100)
    batch_size: int = Field(default=256, ge=32, le=2048)
    max_samples: int = Field(default=200000, ge=1000, le=2000000)


class AutoencoderTrainRequest(BaseModel):
    epochs: int = Field(default=30, ge=1, le=100)
    batch_size: int = Field(default=256, ge=32, le=2048)
    threshold_percentile: float = Field(default=95.0, ge=50.0, le=99.9)
    max_samples: int = Field(default=200000, ge=1000, le=2000000)


class TrainAllRequest(BaseModel):
    rf: RFTrainRequest = Field(default_factory=RFTrainRequest)
    lstm: LSTMTrainRequest = Field(default_factory=LSTMTrainRequest)
    autoencoder: AutoencoderTrainRequest = Field(default_factory=AutoencoderTrainRequest)


# ── Helper ────────────────────────────────────────────────────────────────────

def _check_data_ready():
    if not get_cached_data():
        raise HTTPException(
            status_code=400,
            detail="No preprocessed data found. Upload and preprocess a dataset first via POST /api/v1/data/upload",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/train/random-forest")
async def train_random_forest(req: RFTrainRequest = None):
    """Submit a Random Forest training job (runs in background)."""
    _check_data_ready()
    req = req or RFTrainRequest()
    job = training_service.submit_training_job(
        "random_forest",
        req.model_dump(),
        on_complete=lambda _: inference_service.reload_all(),
    )
    return {"job_id": job.job_id, "status": job.status, "message": job.message}


@router.post("/train/lstm")
async def train_lstm(req: LSTMTrainRequest = None):
    """Submit an LSTM training job (runs in background)."""
    _check_data_ready()
    req = req or LSTMTrainRequest()
    job = training_service.submit_training_job(
        "lstm",
        req.model_dump(),
        on_complete=lambda _: inference_service.reload_all(),
    )
    return {"job_id": job.job_id, "status": job.status, "message": job.message}


@router.post("/train/autoencoder")
async def train_autoencoder(req: AutoencoderTrainRequest = None):
    """Submit an Autoencoder training job (runs in background)."""
    _check_data_ready()
    req = req or AutoencoderTrainRequest()
    job = training_service.submit_training_job(
        "autoencoder",
        req.model_dump(),
        on_complete=lambda _: inference_service.reload_all(),
    )
    return {"job_id": job.job_id, "status": job.status, "message": job.message}


@router.post("/train/all")
async def train_all_models(req: TrainAllRequest = None):
    """Submit training jobs for ALL three models sequentially."""
    _check_data_ready()
    req = req or TrainAllRequest()

    jobs = {}
    for name, params in [
        ("random_forest", req.rf.model_dump()),
        ("lstm", req.lstm.model_dump()),
        ("autoencoder", req.autoencoder.model_dump()),
    ]:
        job = training_service.submit_training_job(
            name, params, on_complete=lambda _: inference_service.reload_all()
        )
        jobs[name] = job.job_id

    return {
        "message": "All training jobs submitted.",
        "job_ids": jobs,
        "note": "Jobs run in parallel background threads. Poll /api/v1/models/jobs/{job_id} for status.",
    }


@router.get("/jobs")
async def list_training_jobs():
    """List all training jobs and their statuses."""
    return {"jobs": list_jobs()}


@router.get("/jobs/{job_id}")
async def get_training_job(job_id: str):
    """Get status and results of a specific training job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job.to_dict()


@router.get("")
async def list_models():
    """List available trained models and their existence on disk."""
    available = inference_service.available_models()
    results = {}
    for name, exists in available.items():
        if name == "pipeline":
            continue
        results[name] = {
            "trained": exists,
            "metrics": None,
        }
        if exists and name != "pipeline":
            try:
                from backend.services.comparison_service import _safe_load_metrics
                metrics = _safe_load_metrics(name)
                if metrics:
                    results[name]["metrics"] = {
                        k: v for k, v in metrics.items()
                        if k in ("accuracy", "macro_f1", "weighted_f1",
                                 "precision", "recall", "f1_score",
                                 "training_time_s", "n_samples_train")
                    }
            except Exception:
                pass

    return {"models": results}


@router.get("/{model_name}/metrics")
async def get_model_metrics(model_name: str):
    """Get full training metrics for a specific model."""
    valid = {"random_forest", "lstm", "autoencoder"}
    if model_name not in valid:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: {model_name}. Choose from {valid}",
        )
    available = inference_service.available_models()
    if not available.get(model_name):
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' has not been trained yet.",
        )
    from backend.services.comparison_service import _safe_load_metrics
    metrics = _safe_load_metrics(model_name)
    if not metrics:
        raise HTTPException(
            status_code=404,
            detail=f"Metrics not found for '{model_name}'.",
        )
    return metrics
