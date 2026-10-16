"""
AI-Based Network Traffic Anomaly Detection System
Backend Configuration
"""

import os
import shutil
import tempfile
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


BASE_DIR = Path(__file__).resolve().parent.parent
IS_VERCEL = bool(os.getenv("VERCEL"))
VERCEL_RUNTIME_DIR = Path(tempfile.gettempdir()) / "network-anomaly-detection"

DEFAULT_MODELS_DIR = (
    VERCEL_RUNTIME_DIR / "trained_models"
    if IS_VERCEL else BASE_DIR / "trained_models"
)
DEFAULT_UPLOADS_DIR = (
    VERCEL_RUNTIME_DIR / "uploads"
    if IS_VERCEL else BASE_DIR / "uploads"
)
DEFAULT_LOGS_DIR = (
    VERCEL_RUNTIME_DIR / "logs"
    if IS_VERCEL else BASE_DIR / "logs"
)
DEFAULT_DB_PATH = (
    VERCEL_RUNTIME_DIR / "database" / "anomaly_detection.db"
    if IS_VERCEL else BASE_DIR / "database" / "anomaly_detection.db"
)

class Settings(BaseSettings):
    """Application settings loaded from environment variables / config."""
    
    # ─── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "AI Network Anomaly Detection System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # ─── Paths ────────────────────────────────────────────────────────────────
    DATA_DIR: Path = BASE_DIR / "data"
    MODELS_DIR: Path = DEFAULT_MODELS_DIR
    UPLOADS_DIR: Path = DEFAULT_UPLOADS_DIR
    LOGS_DIR: Path = DEFAULT_LOGS_DIR
    DB_PATH: Path = DEFAULT_DB_PATH

    # ─── Dataset ──────────────────────────────────────────────────────────────
    DATASET_PATH: Optional[str] = None
    LABEL_COLUMN: str = "Label"
    RANDOM_SEED: int = 42
    TEST_SIZE: float = 0.2
    VALIDATION_SIZE: float = 0.1

    # ─── Preprocessing ────────────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 500
    DROP_COLUMNS: list = []

    # ─── Random Forest ────────────────────────────────────────────────────────
    RF_N_ESTIMATORS: int = 100
    RF_MAX_DEPTH: Optional[int] = None
    RF_MIN_SAMPLES_SPLIT: int = 2
    RF_MIN_SAMPLES_LEAF: int = 1
    RF_MAX_FEATURES: str = "sqrt"
    RF_CLASS_WEIGHT: str = "balanced"

    # ─── LSTM ─────────────────────────────────────────────────────────────────
    LSTM_SEQUENCE_LENGTH: int = 10
    LSTM_UNITS: int = 64
    LSTM_DROPOUT: float = 0.2
    LSTM_EPOCHS: int = 20
    LSTM_BATCH_SIZE: int = 256
    LSTM_MAX_SAMPLES: int = 200000

    # ─── Autoencoder ──────────────────────────────────────────────────────────
    AE_ENCODING_DIM: list = [64, 32, 16]
    AE_EPOCHS: int = 30
    AE_BATCH_SIZE: int = 256
    AE_THRESHOLD_PERCENTILE: float = 95.0
    AE_MAX_SAMPLES: int = 200000

    # ─── API ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    API_PREFIX: str = "/api/v1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
for d in [settings.DATA_DIR, settings.MODELS_DIR, settings.UPLOADS_DIR,
          settings.LOGS_DIR, settings.DB_PATH.parent]:
    d.mkdir(parents=True, exist_ok=True)


def _seed_vercel_runtime_files() -> None:
    """Copy bundled mutable artifacts into Vercel's writable scratch space."""
    if not IS_VERCEL:
        return

    bundled_models = BASE_DIR / "trained_models"
    if settings.MODELS_DIR == DEFAULT_MODELS_DIR and bundled_models.exists():
        for source in bundled_models.iterdir():
            destination = settings.MODELS_DIR / source.name
            if destination.exists():
                continue
            if source.is_dir():
                shutil.copytree(source, destination)
            else:
                shutil.copy2(source, destination)

    bundled_db = BASE_DIR / "database" / "anomaly_detection.db"
    if (
        settings.DB_PATH == DEFAULT_DB_PATH
        and bundled_db.exists()
        and not settings.DB_PATH.exists()
    ):
        shutil.copy2(bundled_db, settings.DB_PATH)


_seed_vercel_runtime_files()
