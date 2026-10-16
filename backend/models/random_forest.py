"""
Random Forest model for multiclass network traffic classification.

Implements:
- Configurable hyperparameters
- class_weight='balanced' to handle imbalance
- Full evaluation: accuracy, precision, recall, F1, confusion matrix
- Feature importance
- Optional SHAP explainability
- Save / Load via joblib
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score,
)

from backend.config import settings

logger = logging.getLogger(__name__)

MODEL_FILENAME = "random_forest.joblib"


class RandomForestModel:
    """
    Multiclass Random Forest classifier wrapper.

    Training:
        model = RandomForestModel(n_estimators=100)
        metrics = model.train(X_train, y_train, X_test, y_test, class_names)
        model.save()

    Inference:
        model = RandomForestModel.load()
        preds, probs = model.predict(X)
    """

    def __init__(
        self,
        n_estimators: int = settings.RF_N_ESTIMATORS,
        max_depth: Optional[int] = settings.RF_MAX_DEPTH,
        min_samples_split: int = settings.RF_MIN_SAMPLES_SPLIT,
        min_samples_leaf: int = settings.RF_MIN_SAMPLES_LEAF,
        max_features: str = settings.RF_MAX_FEATURES,
        class_weight: str = settings.RF_CLASS_WEIGHT,
        random_state: int = settings.RANDOM_SEED,
    ):
        self.params = dict(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            max_features=max_features,
            class_weight=class_weight,
            random_state=random_state,
            n_jobs=-1,
        )
        self.clf: Optional[RandomForestClassifier] = None
        self.feature_importances_: Optional[np.ndarray] = None
        self.training_metrics: Dict[str, Any] = {}
        self.is_trained: bool = False

    # ── Training ─────────────────────────────────────────────────────────────

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        class_names: List[str],
        feature_names: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Train and evaluate. Returns full metrics dict."""
        logger.info(f"Training RandomForest with params: {self.params}")
        t0 = time.time()

        self.clf = RandomForestClassifier(**self.params)
        self.clf.fit(X_train, y_train)
        training_time = time.time() - t0
        logger.info(f"Training done in {training_time:.1f}s")

        self.feature_importances_ = self.clf.feature_importances_
        self.is_trained = True

        # ── Evaluate ─────────────────────────────────────────────────────────
        t1 = time.time()
        y_pred = self.clf.predict(X_test)
        inference_time_ms = (time.time() - t1) * 1000 / max(len(X_test), 1)

        report = classification_report(
            y_test, y_pred, target_names=class_names, output_dict=True, zero_division=0
        )
        cm = confusion_matrix(y_test, y_pred)

        metrics = {
            "model_name": "random_forest",
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average="weighted", zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average="weighted", zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
            "macro_f1": float(f1_score(y_test, y_pred, average="macro", zero_division=0)),
            "weighted_f1": float(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
            "training_time_s": round(training_time, 2),
            "inference_time_ms": round(inference_time_ms, 4),
            "n_samples_train": int(len(X_train)),
            "n_samples_test": int(len(X_test)),
            "n_features": int(X_train.shape[1]),
            "classification_report": report,
            "confusion_matrix": cm.tolist(),
            "class_names": class_names,
            "params": self.params,
        }

        # Feature importance
        if feature_names:
            fi = sorted(
                zip(feature_names, self.clf.feature_importances_),
                key=lambda x: x[1],
                reverse=True,
            )
            metrics["feature_importance"] = {name: float(imp) for name, imp in fi}
            metrics["top_features"] = [
                {"feature": name, "importance": float(imp)}
                for name, imp in fi[:20]
            ]

        self.training_metrics = metrics
        logger.info(
            f"RF results — accuracy={metrics['accuracy']:.4f}, "
            f"macro_f1={metrics['macro_f1']:.4f}"
        )
        return metrics

    # ── Inference ─────────────────────────────────────────────────────────────

    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Return (predicted_classes, probabilities)."""
        if not self.is_trained or self.clf is None:
            raise RuntimeError("Model not trained. Call train() or load() first.")
        preds = self.clf.predict(X)
        probs = self.clf.predict_proba(X)
        return preds, probs

    def predict_single(self, x: np.ndarray) -> Tuple[int, np.ndarray]:
        """Predict a single sample (1-D array)."""
        preds, probs = self.predict(x.reshape(1, -1))
        return int(preds[0]), probs[0]

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Optional[Path] = None) -> Path:
        path = path or (settings.MODELS_DIR / MODEL_FILENAME)
        joblib.dump(
            {"clf": self.clf, "params": self.params, "metrics": self.training_metrics},
            path,
        )
        logger.info(f"RandomForest saved to {path}")
        return path

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "RandomForestModel":
        path = path or (settings.MODELS_DIR / MODEL_FILENAME)
        if not path.exists():
            raise FileNotFoundError(f"RandomForest model not found at {path}")
        payload = joblib.load(path)
        inst = cls(**{k: v for k, v in payload["params"].items()
                      if k not in ("n_jobs",)})
        inst.clf = payload["clf"]
        inst.training_metrics = payload.get("metrics", {})
        inst.is_trained = True
        if inst.clf is not None:
            inst.feature_importances_ = inst.clf.feature_importances_
        logger.info(f"RandomForest loaded from {path}")
        return inst

    # ── Explainability (optional SHAP) ────────────────────────────────────────

    def explain_shap(
        self, X: np.ndarray, feature_names: List[str], max_samples: int = 100
    ) -> Optional[Dict]:
        """Compute SHAP values for a sample. Returns None if SHAP not installed."""
        try:
            import shap
            explainer = shap.TreeExplainer(self.clf)
            X_sample = X[:max_samples]
            shap_values = explainer.shap_values(X_sample)
            mean_abs = np.abs(shap_values).mean(axis=(0, 2)) if shap_values.ndim == 3 \
                else np.abs(shap_values).mean(axis=0)
            return {
                "feature_names": feature_names,
                "mean_abs_shap": mean_abs.tolist(),
            }
        except ImportError:
            logger.warning("SHAP not installed; skipping SHAP explanation")
            return None
        except Exception as exc:
            logger.warning(f"SHAP computation failed: {exc}")
            return None
