"""
Autoencoder-based anomaly detector.

DESIGN PRINCIPLE:
    The autoencoder is trained ONLY on BENIGN (normal) traffic.
    During inference, if the reconstruction error exceeds a learned threshold,
    the sample is flagged as ANOMALOUS.

    This is inherently a binary detector (NORMAL / ANOMALOUS).
    It does NOT identify specific attack categories.
    If you need attack category identification, use the supervised models.

Architecture:
    Input
    → Encoder: Dense(enc_dims[0]) → Dense(enc_dims[1]) → Dense(enc_dims[2])  [latent]
    → Decoder: Dense(enc_dims[1]) → Dense(enc_dims[0]) → Dense(n_features)
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score,
)

from backend.config import settings

logger = logging.getLogger(__name__)
MODEL_FILENAME = "autoencoder_model.keras"
META_FILENAME = "autoencoder_meta.joblib"


class AutoencoderModel:
    """
    Reconstruction-error-based anomaly detector.

    train() expects X_train to be BENIGN-ONLY (or majority benign).
    The anomaly threshold is computed from training reconstruction errors
    at a configurable percentile.

    predict() returns (is_anomaly_bool_array, reconstruction_errors).
    """

    def __init__(
        self,
        encoding_dims: List[int] = None,
        epochs: int = settings.AE_EPOCHS,
        batch_size: int = settings.AE_BATCH_SIZE,
        threshold_percentile: float = settings.AE_THRESHOLD_PERCENTILE,
        max_samples: int = settings.AE_MAX_SAMPLES,
        random_state: int = settings.RANDOM_SEED,
    ):
        self.encoding_dims: List[int] = encoding_dims or settings.AE_ENCODING_DIM
        self.epochs = epochs
        self.batch_size = batch_size
        self.threshold_percentile = threshold_percentile
        self.max_samples = max_samples
        self.random_state = random_state

        self.model = None           # Keras autoencoder
        self.threshold: float = 0.0
        self.n_features: int = 0
        self.training_metrics: Dict[str, Any] = {}
        self.is_trained: bool = False

    # ── Build ────────────────────────────────────────────────────────────────

    def _build_model(self, n_features: int):
        """Build encoder–decoder Keras model."""
        from tensorflow import keras

        inp = keras.layers.Input(shape=(n_features,))
        x = inp
        # Encoder
        for dim in self.encoding_dims:
            x = keras.layers.Dense(dim, activation="relu")(x)
        # Decoder (mirror)
        for dim in reversed(self.encoding_dims[:-1]):
            x = keras.layers.Dense(dim, activation="relu")(x)
        out = keras.layers.Dense(n_features, activation="sigmoid")(x)

        model = keras.Model(inputs=inp, outputs=out)
        model.compile(optimizer="adam", loss="mse")
        return model

    # ── Training ─────────────────────────────────────────────────────────────

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,           # used to filter BENIGN
        X_test: np.ndarray,
        y_test: np.ndarray,
        class_names: List[str],
        benign_label_index: int = 0,   # index of BENIGN in label encoder
    ) -> Dict[str, Any]:
        """
        Train the autoencoder on benign-only data, then evaluate on the full test set.

        Parameters
        ----------
        benign_label_index: int
            The integer-encoded label that corresponds to BENIGN.
            Determined from the LabelEncoder used in preprocessing.
        """
        from tensorflow import keras
        np.random.seed(self.random_state)

        # ── Filter benign-only training data ─────────────────────────────────
        benign_mask = y_train == benign_label_index
        X_benign = X_train[benign_mask]
        logger.info(
            f"Autoencoder: {X_benign.shape[0]} BENIGN samples out of {len(X_train)} total"
        )

        if len(X_benign) == 0:
            raise ValueError(
                "No BENIGN samples found in training data. "
                "Check that benign_label_index is correct."
            )

        # Sub-sample if too large
        actual_benign = len(X_benign)
        if len(X_benign) > self.max_samples:
            idx = np.random.choice(len(X_benign), self.max_samples, replace=False)
            X_benign = X_benign[idx]
            logger.info(f"Sub-sampled BENIGN from {actual_benign} to {len(X_benign)}")

        self.n_features = X_benign.shape[1]
        self.model = self._build_model(self.n_features)

        model_path = settings.MODELS_DIR / MODEL_FILENAME
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=5, restore_best_weights=True
            ),
            keras.callbacks.ModelCheckpoint(
                str(model_path), save_best_only=True, monitor="val_loss"
            ),
        ]

        t0 = time.time()
        history = self.model.fit(
            X_benign, X_benign,          # input == target (reconstruction)
            validation_split=0.1,
            epochs=self.epochs,
            batch_size=self.batch_size,
            callbacks=callbacks,
            verbose=0,
        )
        training_time = time.time() - t0
        logger.info(f"Autoencoder training done in {training_time:.1f}s")

        # ── Compute threshold from benign reconstruction errors ───────────────
        train_recon = self.model.predict(X_benign, batch_size=self.batch_size, verbose=0)
        train_errors = np.mean(np.power(X_benign - train_recon, 2), axis=1)
        self.threshold = float(np.percentile(train_errors, self.threshold_percentile))
        logger.info(
            f"Anomaly threshold (p{self.threshold_percentile:.0f}): {self.threshold:.6f}"
        )

        # ── Evaluate on full test set ─────────────────────────────────────────
        t1 = time.time()
        test_recon = self.model.predict(X_test, batch_size=self.batch_size, verbose=0)
        test_errors = np.mean(np.power(X_test - test_recon, 2), axis=1)
        inference_time_ms = (time.time() - t1) * 1000 / max(len(X_test), 1)

        y_pred_binary = (test_errors > self.threshold).astype(int)
        y_true_binary = (y_test != benign_label_index).astype(int)

        # Safely compute ROC-AUC
        try:
            auc = float(roc_auc_score(y_true_binary, test_errors))
        except Exception:
            auc = None

        # Error distribution stats
        benign_errors = test_errors[y_true_binary == 0]
        attack_errors = test_errors[y_true_binary == 1]

        metrics = {
            "model_name": "autoencoder",
            "anomaly_precision": float(precision_score(y_true_binary, y_pred_binary, zero_division=0)),
            "anomaly_recall": float(recall_score(y_true_binary, y_pred_binary, zero_division=0)),
            "anomaly_f1": float(f1_score(y_true_binary, y_pred_binary, zero_division=0)),
            "accuracy": float(accuracy_score(y_true_binary, y_pred_binary)),
            "precision": float(precision_score(y_true_binary, y_pred_binary, zero_division=0)),
            "recall": float(recall_score(y_true_binary, y_pred_binary, zero_division=0)),
            "f1_score": float(f1_score(y_true_binary, y_pred_binary, zero_division=0)),
            "macro_f1": float(f1_score(y_true_binary, y_pred_binary, average="macro", zero_division=0)),
            "weighted_f1": float(f1_score(y_true_binary, y_pred_binary, average="weighted", zero_division=0)),
            "roc_auc": auc,
            "threshold": self.threshold,
            "threshold_percentile": self.threshold_percentile,
            "training_time_s": round(training_time, 2),
            "inference_time_ms": round(inference_time_ms, 4),
            "n_samples_train": int(len(X_benign)),
            "n_samples_test": int(len(X_test)),
            "n_features": int(self.n_features),
            "benign_mean_error": float(benign_errors.mean()) if len(benign_errors) else None,
            "attack_mean_error": float(attack_errors.mean()) if len(attack_errors) else None,
            "confusion_matrix": confusion_matrix(y_true_binary, y_pred_binary).tolist(),
            "class_names": ["NORMAL", "ANOMALY"],
            "training_history": {
                "loss": [float(v) for v in history.history.get("loss", [])],
                "val_loss": [float(v) for v in history.history.get("val_loss", [])],
            },
            "note": (
                "Autoencoder performs BINARY detection (NORMAL vs ANOMALY). "
                "It does NOT identify specific attack categories."
            ),
        }
        self.training_metrics = metrics
        self.is_trained = True

        logger.info(
            f"Autoencoder — anomaly_f1={metrics['anomaly_f1']:.4f}, "
            f"roc_auc={f'{auc:.4f}' if auc is not None else 'N/A'}"
        )
        return metrics

    # ── Inference ─────────────────────────────────────────────────────────────

    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Returns (is_anomaly, reconstruction_errors).
        is_anomaly: bool array — True means anomalous.
        """
        if not self.is_trained or self.model is None:
            raise RuntimeError("Autoencoder not trained.")
        recon = self.model.predict(X, batch_size=self.batch_size, verbose=0)
        errors = np.mean(np.power(X - recon, 2), axis=1)
        is_anomaly = errors > self.threshold
        return is_anomaly, errors

    def anomaly_score(self, X: np.ndarray) -> np.ndarray:
        """Return raw reconstruction errors as anomaly scores."""
        _, errors = self.predict(X)
        return errors

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Optional[Path] = None) -> Path:
        path = path or (settings.MODELS_DIR / MODEL_FILENAME)
        self.model.save(str(path))
        meta_path = path.parent / META_FILENAME
        joblib.dump({
            "encoding_dims": self.encoding_dims,
            "epochs": self.epochs,
            "batch_size": self.batch_size,
            "threshold": self.threshold,
            "threshold_percentile": self.threshold_percentile,
            "n_features": self.n_features,
            "training_metrics": self.training_metrics,
        }, meta_path)
        logger.info(f"Autoencoder saved to {path}")
        return path

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "AutoencoderModel":
        import tensorflow as tf
        path = path or (settings.MODELS_DIR / MODEL_FILENAME)
        if not path.exists():
            raise FileNotFoundError(f"Autoencoder model not found at {path}")
        meta_path = path.parent / META_FILENAME
        meta = joblib.load(meta_path)

        inst = cls(
            encoding_dims=meta["encoding_dims"],
            epochs=meta["epochs"],
            batch_size=meta["batch_size"],
            threshold_percentile=meta["threshold_percentile"],
        )
        inst.model = tf.keras.models.load_model(str(path))
        inst.threshold = meta["threshold"]
        inst.n_features = meta["n_features"]
        inst.training_metrics = meta.get("training_metrics", {})
        inst.is_trained = True
        logger.info(f"Autoencoder loaded from {path}")
        return inst
