"""
Data upload and preprocessing API endpoints.
"""

import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.services.training_service import training_service
from backend.services.demo_data import get_or_create_demo_csv

router = APIRouter(prefix="/data", tags=["Data"])

ALLOWED_EXTENSIONS = {".csv"}
MAX_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    label_column: Optional[str] = Form(None),
    nrows: Optional[int] = Form(None),
):
    """
    Upload a CIC-IDS 2017 CSV (or compatible) for preprocessing.
    The file is validated, saved to the uploads directory, and preprocessed.
    """
    # Validate extension
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Only CSV files are accepted. Got: {suffix}",
        )

    # Validate size
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents) // 1024 // 1024} MB). "
                   f"Maximum: {settings.MAX_FILE_SIZE_MB} MB",
        )

    # Save to uploads dir
    save_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    save_path = settings.UPLOADS_DIR / save_name
    save_path.write_bytes(contents)

    try:
        summary = training_service.preprocess_dataset(
            save_path,
            label_column=label_column,
            nrows=nrows,
        )
        summary["filename"] = file.filename
        summary["saved_as"] = save_name
        summary["is_demo"] = False
        return summary
    except Exception as exc:
        # Clean up on failure
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/demo")
async def load_demo_dataset(
    n_samples: int = Form(default=5000),
):
    """
    Generate and load a clearly-labeled SYNTHETIC demo dataset
    for testing the pipeline without the real CIC-IDS 2017 dataset.

    WARNING: Results from this endpoint are synthetic and MUST NOT be
             presented as CIC-IDS 2017 results.
    """
    demo_path = get_or_create_demo_csv(n_samples=n_samples)
    try:
        summary = training_service.preprocess_dataset(demo_path)
        summary["filename"] = "demo_dataset.csv (SYNTHETIC)"
        summary["is_demo"] = True
        summary["demo_warning"] = (
            "⚠️ DEMO MODE: This is SYNTHETIC data generated for pipeline testing only. "
            "Results do NOT represent real CIC-IDS 2017 performance."
        )
        return summary
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/status")
async def data_status():
    """Check if data has been preprocessed and is ready for training."""
    from backend.services.training_service import get_cached_data
    cache = get_cached_data()
    pipeline_exists = (settings.MODELS_DIR / "preprocessing_pipeline.joblib").exists()

    if cache:
        return {
            "status": "ready",
            "n_train": int(len(cache["X_train"])),
            "n_test": int(len(cache["X_test"])),
            "n_features": int(cache["X_train"].shape[1]),
            "class_names": cache["class_names"],
            "pipeline_saved": pipeline_exists,
        }
    elif pipeline_exists:
        return {
            "status": "pipeline_exists_no_cache",
            "message": "Pipeline exists on disk but data not in memory. Re-upload to retrain.",
            "pipeline_saved": True,
        }
    else:
        return {
            "status": "no_data",
            "message": "No dataset loaded. Upload a CSV or use the demo dataset.",
            "pipeline_saved": False,
        }
