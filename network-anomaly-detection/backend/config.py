"""
AI-Based Network Traffic Anomaly Detection System
Backend Configuration
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """Application settings loaded from environment variables / config."""
    
    # ─── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "AI Network Anomaly Detection System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # ─── Paths ────────────────────────────────────────────────────────────────
    DATA_DIR: Path = BASE_DIR / "data"
    MODELS_DIR: Path = BASE_DIR / "trained_models"
    UPLOADS_DIR: Path = BASE_DIR / "uploads"
    LOGS_DIR: Path = BASE_DIR / "logs"
    DB_PATH: Path = BASE_DIR / "database" / "anomaly_detection.db"

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
