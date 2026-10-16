"""
Training service that orchestrates the full train/evaluate/save pipeline.
Runs in a background thread so the API remains responsive.
"""

from __future__ import annotations

import json
import logging
import threading
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import numpy as np

from backend.config import settings
from backend.models.random_forest import RandomForestModel
from backend.models.lstm_model import LSTMModel
from backend.models.autoencoder import AutoencoderModel
from backend.preprocessing.pipeline import PreprocessingPipeline, load_csv, detect_label_column

logger = logging.getLogger(__name__)


# ── Training Job State ────────────────────────────────────────────────────────

class TrainingJob:
    """Tracks the state of a background training job."""

    def __init__(self, job_id: str, model_name: str):
        self.job_id = job_id
        self.model_name = model_name
        self.status: str = "pending"   # pending | running | done | error
        self.progress: int = 0          # 0-100
        self.message: str = "Queued"
        self.error: Optional[str] = None
        self.result: Optional[Dict] = None
        self.started_at: Optional[datetime] = None
        self.finished_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        return {
            "job_id": self.job_id,
            "model_name": self.model_name,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "result": self.result,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
        }


# ── Global job registry ───────────────────────────────────────────────────────
_jobs: Dict[str, TrainingJob] = {}
_lock = threading.Lock()


def get_job(job_id: str) -> Optional[TrainingJob]:
    return _jobs.get(job_id)


def list_jobs() -> List[Dict]:
    return [j.to_dict() for j in _jobs.values()]


# ── Shared preprocessed data cache ───────────────────────────────────────────
_data_cache: Dict[str, Any] = {}


def get_cached_data() -> Optional[Dict]:
    return _data_cache if _data_cache else None


def set_cached_data(data: Dict):
    global _data_cache
    _data_cache = data


# ── Training orchestrator ─────────────────────────────────────────────────────

class TrainingService:
    """
    Manages dataset loading, preprocessing, and model training.
    """

    def preprocess_dataset(
        self,
        csv_path: Path,
        label_column: Optional[str] = None,
        nrows: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Load → clean → split → scale → cache.
        Returns a summary dict.
        """
        logger.info(f"Loading dataset from {csv_path}")
        df = load_csv(csv_path, nrows=nrows)

        # Auto-detect label column
        if label_column is None:
            label_column = detect_label_column(df)
            logger.info(f"Auto-detected label column: '{label_column}'")

        # Label distribution
        raw_labels = df[label_column].value_counts().to_dict()

        pipeline = PreprocessingPipeline()
        X_train, X_test, y_train, y_test, X_train_sm, y_train_sm = pipeline.run(
            df, label_column=label_column
        )
        pipeline.save()

        class_names = pipeline.get_label_names()

        # Find BENIGN label index
        benign_idx = 0
        if "BENIGN" in class_names:
            benign_idx = list(class_names).index("BENIGN")

        cache = {
            "X_train": X_train,
            "X_test": X_test,
            "y_train": y_train,
            "y_test": y_test,
            "X_train_sm": X_train_sm,
            "y_train_sm": y_train_sm,
            "class_names": class_names,
            "benign_idx": benign_idx,
            "feature_columns": pipeline.feature_columns,
            "pipeline_config": pipeline.config,
            "preprocessing_log": pipeline.preprocessing_log,
        }
        set_cached_data(cache)

        label_dist = {}
        for i, name in enumerate(class_names):
            count = int(np.sum(y_test == i)) + int(np.sum(y_train == i))
            label_dist[name] = count

        return {
            "n_rows": int(pipeline.config.get("n_total", 0)),
            "n_features": int(pipeline.config.get("n_features", 0)),
            "n_train": int(pipeline.config.get("n_train", 0)),
            "n_test": int(pipeline.config.get("n_test", 0)),
            "n_train_after_smote": int(pipeline.config.get("n_train_after_smote", 0)),
            "label_column": label_column,
            "class_names": class_names,
            "label_distribution": label_dist,
            "raw_label_distribution": {str(k): int(v) for k, v in raw_labels.items()},
            "preprocessing_log": pipeline.preprocessing_log,
        }

    # ── Training methods ──────────────────────────────────────────────────────

    def _run_random_forest(self, job: TrainingJob, params: Dict) -> Dict:
        cache = get_cached_data()
        if not cache:
            raise RuntimeError("No preprocessed data found. Upload and preprocess a dataset first.")

        job.message = "Training Random Forest…"
        job.progress = 10

        model = RandomForestModel(
            n_estimators=params.get("n_estimators", settings.RF_N_ESTIMATORS),
            max_depth=params.get("max_depth", settings.RF_MAX_DEPTH),
            min_samples_split=params.get("min_samples_split", settings.RF_MIN_SAMPLES_SPLIT),
            min_samples_leaf=params.get("min_samples_leaf", settings.RF_MIN_SAMPLES_LEAF),
        )

        # Use SMOTE-balanced training data
        metrics = model.train(
            cache["X_train_sm"], cache["y_train_sm"],
            cache["X_test"], cache["y_test"],
            cache["class_names"],
            feature_names=cache["feature_columns"],
        )
        model.save()
        job.progress = 90
        job.message = "Random Forest saved."
        return metrics

    def _run_lstm(self, job: TrainingJob, params: Dict) -> Dict:
        cache = get_cached_data()
        if not cache:
            raise RuntimeError("No preprocessed data found.")

        job.message = "Building LSTM sequences and training…"
        job.progress = 10

        model = LSTMModel(
            sequence_length=params.get("sequence_length", settings.LSTM_SEQUENCE_LENGTH),
            units=params.get("units", settings.LSTM_UNITS),
            epochs=params.get("epochs", settings.LSTM_EPOCHS),
            batch_size=params.get("batch_size", settings.LSTM_BATCH_SIZE),
            max_samples=params.get("max_samples", settings.LSTM_MAX_SAMPLES),
        )

        metrics = model.train(
            cache["X_train"], cache["y_train"],
            cache["X_test"], cache["y_test"],
            cache["class_names"],
        )
        model.save()
        job.progress = 90
        job.message = "LSTM saved."
        return metrics

    def _run_autoencoder(self, job: TrainingJob, params: Dict) -> Dict:
        cache = get_cached_data()
        if not cache:
            raise RuntimeError("No preprocessed data found.")

        job.message = "Training Autoencoder on BENIGN traffic…"
        job.progress = 10

        model = AutoencoderModel(
            epochs=params.get("epochs", settings.AE_EPOCHS),
            batch_size=params.get("batch_size", settings.AE_BATCH_SIZE),
            threshold_percentile=params.get(
                "threshold_percentile", settings.AE_THRESHOLD_PERCENTILE
            ),
            max_samples=params.get("max_samples", settings.AE_MAX_SAMPLES),
        )

        metrics = model.train(
            cache["X_train"], cache["y_train"],
            cache["X_test"], cache["y_test"],
            cache["class_names"],
            benign_label_index=cache["benign_idx"],
        )
        model.save()
        job.progress = 90
        job.message = "Autoencoder saved."
        return metrics

    # ── Job dispatch ──────────────────────────────────────────────────────────

    def submit_training_job(
        self,
        model_name: str,
        params: Dict,
        on_complete: Optional[Callable[[Dict], None]] = None,
    ) -> TrainingJob:
        """Launch a training job in a background thread. Returns the job object."""
        import uuid
        job_id = str(uuid.uuid4())[:8]
        job = TrainingJob(job_id=job_id, model_name=model_name)

        with _lock:
            _jobs[job_id] = job

        def _run():
            job.status = "running"
            job.started_at = datetime.utcnow()
            try:
                if model_name == "random_forest":
                    result = self._run_random_forest(job, params)
                elif model_name == "lstm":
                    result = self._run_lstm(job, params)
                elif model_name == "autoencoder":
                    result = self._run_autoencoder(job, params)
                else:
                    raise ValueError(f"Unknown model: {model_name}")

                job.result = result
                job.status = "done"
                job.progress = 100
                job.message = f"{model_name} training complete."
                if on_complete:
                    on_complete(result)
            except Exception as exc:
                job.status = "error"
                job.error = str(exc)
                job.message = f"Training failed: {exc}"
                logger.error(f"Training job {job_id} failed:\n{traceback.format_exc()}")
            finally:
                job.finished_at = datetime.utcnow()

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        return job


# Singleton
training_service = TrainingService()
