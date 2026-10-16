"""
LSTM model for network traffic sequence classification.

Because CIC-IDS 2017 flows are tabular (not natural sequences), we construct
temporal windows: consecutive groups of `sequence_length` flows are treated as
a single LSTM input. The label of the last flow in the window is the target.

Architecture:
    Input (seq_len, n_features)
    → LSTM(units, return_sequences=True)
    → Dropout
    → LSTM(units // 2)
    → Dropout
    → Dense(n_classes, activation='softmax')
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score,
)
from sklearn.utils.class_weight import compute_class_weight

from backend.config import settings

logger = logging.getLogger(__name__)
MODEL_FILENAME = "lstm_model.keras"


def _build_sequences(
    X: np.ndarray,
    y: np.ndarray,
    seq_len: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Convert a 2-D feature array into overlapping sequences.

    Each sequence contains `seq_len` consecutive rows.
    The label is the class of the LAST row in the window.

    Returns:
        X_seq: shape (n_sequences, seq_len, n_features)
        y_seq: shape (n_sequences,)
    """
    n_samples = len(X)
    if n_samples < seq_len:
        raise ValueError(
            f"Not enough samples ({n_samples}) to build sequences of length {seq_len}"
        )

    n_sequences = n_samples - seq_len + 1
    X_seq = np.lib.stride_tricks.sliding_window_view(X, (seq_len, X.shape[1]))
    X_seq = X_seq[:, 0, :, :]            # shape: (n_sequences, seq_len, n_features)
    y_seq = y[seq_len - 1:]              # label of the last element in each window
    return X_seq.astype(np.float32), y_seq.astype(np.int32)


class LSTMModel:
    """
    LSTM classifier for temporal window sequences of network flows.
    """

    def __init__(
        self,
        sequence_length: int = settings.LSTM_SEQUENCE_LENGTH,
        units: int = settings.LSTM_UNITS,
        dropout: float = settings.LSTM_DROPOUT,
        epochs: int = settings.LSTM_EPOCHS,
        batch_size: int = settings.LSTM_BATCH_SIZE,
        max_samples: int = settings.LSTM_MAX_SAMPLES,
        random_state: int = settings.RANDOM_SEED,
    ):
        self.sequence_length = sequence_length
        self.units = units
        self.dropout = dropout
        self.epochs = epochs
        self.batch_size = batch_size
        self.max_samples = max_samples
        self.random_state = random_state

        self.model = None          # Keras model
        self.n_classes: int = 0
        self.n_features: int = 0
        self.training_history: Dict = {}
        self.training_metrics: Dict[str, Any] = {}
        self.is_trained: bool = False

    # ── Build ────────────────────────────────────────────────────────────────

    def _build_model(self, n_features: int, n_classes: int):
        """Construct the Keras LSTM model."""
        # Import here to avoid slow startup when TF not needed
        import tensorflow as tf
        from tensorflow import keras

        tf.random.set_seed(self.random_state)

        model = keras.Sequential([
            keras.layers.Input(shape=(self.sequence_length, n_features)),
            keras.layers.LSTM(self.units, return_sequences=True),
            keras.layers.Dropout(self.dropout),
            keras.layers.LSTM(self.units // 2),
            keras.layers.Dropout(self.dropout),
            keras.layers.Dense(64, activation="relu"),
            keras.layers.Dense(n_classes, activation="softmax"),
        ])
        model.compile(
            optimizer="adam",
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )
        return model

    # ── Training ─────────────────────────────────────────────────────────────

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        class_names: List[str],
    ) -> Dict[str, Any]:
        """Train LSTM on sequence data."""
        from tensorflow import keras

        np.random.seed(self.random_state)

        # Sub-sample if dataset is too large
        actual_train = len(X_train)
        if len(X_train) > self.max_samples:
            idx = np.random.choice(len(X_train), self.max_samples, replace=False)
            X_train, y_train = X_train[idx], y_train[idx]
            logger.info(
                f"LSTM: Sub-sampled training data from {actual_train} to {len(X_train)} "
                f"(configured max_samples={self.max_samples})"
            )

        self.n_features = X_train.shape[1]
        self.n_classes = len(class_names)

        logger.info(f"Building LSTM sequences (seq_len={self.sequence_length})…")
        X_seq_train, y_seq_train = _build_sequences(X_train, y_train, self.sequence_length)
        X_seq_test, y_seq_test = _build_sequences(X_test, y_test, self.sequence_length)

        logger.info(
            f"LSTM sequences — train: {X_seq_train.shape}, test: {X_seq_test.shape}"
        )

        # Class weights
        classes = np.unique(y_seq_train)
        weights = compute_class_weight("balanced", classes=classes, y=y_seq_train)
        class_weight_dict = dict(zip(classes.tolist(), weights.tolist()))

        self.model = self._build_model(self.n_features, self.n_classes)

        model_path = settings.MODELS_DIR / MODEL_FILENAME
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=3, restore_best_weights=True
            ),
            keras.callbacks.ModelCheckpoint(
                str(model_path), save_best_only=True, monitor="val_loss"
            ),
        ]

        t0 = time.time()
        history = self.model.fit(
            X_seq_train, y_seq_train,
            validation_split=0.1,
            epochs=self.epochs,
            batch_size=self.batch_size,
            class_weight=class_weight_dict,
            callbacks=callbacks,
            verbose=0,
        )
        training_time = time.time() - t0
        logger.info(f"LSTM training done in {training_time:.1f}s")

        self.training_history = {
            "loss": [float(v) for v in history.history.get("loss", [])],
            "val_loss": [float(v) for v in history.history.get("val_loss", [])],
            "accuracy": [float(v) for v in history.history.get("accuracy", [])],
            "val_accuracy": [float(v) for v in history.history.get("val_accuracy", [])],
        }

        # Evaluate
        t1 = time.time()
        y_pred_probs = self.model.predict(X_seq_test, batch_size=self.batch_size, verbose=0)
        y_pred = np.argmax(y_pred_probs, axis=1)
        inference_time_ms = (time.time() - t1) * 1000 / max(len(X_seq_test), 1)

        report = classification_report(
            y_seq_test, y_pred, target_names=class_names, output_dict=True, zero_division=0
        )
        cm = confusion_matrix(y_seq_test, y_pred)

        metrics = {
            "model_name": "lstm",
            "accuracy": float(accuracy_score(y_seq_test, y_pred)),
            "precision": float(precision_score(y_seq_test, y_pred, average="weighted", zero_division=0)),
            "recall": float(recall_score(y_seq_test, y_pred, average="weighted", zero_division=0)),
            "f1_score": float(f1_score(y_seq_test, y_pred, average="weighted", zero_division=0)),
            "macro_f1": float(f1_score(y_seq_test, y_pred, average="macro", zero_division=0)),
            "weighted_f1": float(f1_score(y_seq_test, y_pred, average="weighted", zero_division=0)),
            "training_time_s": round(training_time, 2),
            "inference_time_ms": round(inference_time_ms, 4),
            "n_samples_train": int(len(X_seq_train)),
            "n_samples_test": int(len(X_seq_test)),
            "n_features": int(self.n_features),
            "sequence_length": self.sequence_length,
            "actual_train_before_subsample": actual_train,
            "classification_report": report,
            "confusion_matrix": cm.tolist(),
            "class_names": class_names,
            "training_history": self.training_history,
        }
        self.training_metrics = metrics
        self.is_trained = True

        logger.info(
            f"LSTM results — accuracy={metrics['accuracy']:.4f}, macro_f1={metrics['macro_f1']:.4f}"
        )
        return metrics

    # ── Inference ─────────────────────────────────────────────────────────────

    def predict_sequences(self, X_seq: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Predict on pre-built sequences."""
        if not self.is_trained or self.model is None:
            raise RuntimeError("LSTM not trained.")
        probs = self.model.predict(X_seq, verbose=0)
        preds = np.argmax(probs, axis=1)
        return preds, probs

    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict on raw (non-sequence) features.
        Builds sequences internally; returns predictions for the last
        `len(X) - seq_len + 1` samples.
        """
        X_seq, _ = _build_sequences(X, np.zeros(len(X), dtype=int), self.sequence_length)
        return self.predict_sequences(X_seq)

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Optional[Path] = None) -> Path:
        import tensorflow as tf
        path = path or (settings.MODELS_DIR / MODEL_FILENAME)
        self.model.save(str(path))

        # Save metadata separately
        meta_path = path.parent / "lstm_meta.joblib"
        import joblib
        joblib.dump({
            "sequence_length": self.sequence_length,
            "units": self.units,
            "dropout": self.dropout,
            "n_classes": self.n_classes,
            "n_features": self.n_features,
            "training_metrics": self.training_metrics,
            "training_history": self.training_history,
        }, meta_path)
        logger.info(f"LSTM saved to {path}")
        return path

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "LSTMModel":
        import tensorflow as tf
        import joblib
        path = path or (settings.MODELS_DIR / MODEL_FILENAME)
        if not path.exists():
            raise FileNotFoundError(f"LSTM model not found at {path}")

        meta_path = path.parent / "lstm_meta.joblib"
        meta = joblib.load(meta_path)

        inst = cls(
            sequence_length=meta["sequence_length"],
            units=meta["units"],
            dropout=meta["dropout"],
        )
        inst.model = tf.keras.models.load_model(str(path))
        inst.n_classes = meta["n_classes"]
        inst.n_features = meta["n_features"]
        inst.training_metrics = meta.get("training_metrics", {})
        inst.training_history = meta.get("training_history", {})
        inst.is_trained = True
        logger.info(f"LSTM loaded from {path}")
        return inst
