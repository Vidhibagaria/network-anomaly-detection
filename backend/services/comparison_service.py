"""
Model comparison service.
Aggregates stored metrics from all trained models into a unified comparison table.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from backend.config import settings
from backend.models.random_forest import RandomForestModel
from backend.models.lstm_model import LSTMModel
from backend.models.autoencoder import AutoencoderModel


def _safe_load_metrics(model_name: str) -> Optional[Dict]:
    """Attempt to load metrics from a saved model without crashing."""
    try:
        if model_name == "random_forest":
            m = RandomForestModel.load()
            return m.training_metrics
        elif model_name == "lstm":
            m = LSTMModel.load()
            return m.training_metrics
        elif model_name == "autoencoder":
            m = AutoencoderModel.load()
            return m.training_metrics
    except Exception:
        return None


def compare_models() -> Dict[str, Any]:
    """
    Load metrics from all trained models and return a comparison dictionary.

    Returns:
        {
            "models": { model_name: metrics_dict, ... },
            "comparison_table": [ {model, accuracy, precision, ...}, ... ],
            "best_supervised": str,
            "best_anomaly_detector": str,
        }
    """
    MODEL_NAMES = ["random_forest", "lstm", "autoencoder"]
    metrics_map: Dict[str, Dict] = {}

    for name in MODEL_NAMES:
        m = _safe_load_metrics(name)
        if m:
            metrics_map[name] = m

    if not metrics_map:
        return {
            "models": {},
            "comparison_table": [],
            "best_supervised": None,
            "best_anomaly_detector": None,
            "message": "No trained models found. Please train models first.",
        }

    # ── Build comparison table ────────────────────────────────────────────────
    rows = []
    for name, m in metrics_map.items():
        row = {
            "model_name": name,
            "accuracy": m.get("accuracy"),
            "precision": m.get("precision"),
            "recall": m.get("recall"),
            "f1_score": m.get("f1_score"),
            "macro_f1": m.get("macro_f1"),
            "weighted_f1": m.get("weighted_f1"),
            "training_time_s": m.get("training_time_s"),
            "inference_time_ms": m.get("inference_time_ms"),
            "n_samples_train": m.get("n_samples_train"),
            "n_samples_test": m.get("n_samples_test"),
        }
        # Autoencoder-specific
        if name == "autoencoder":
            row["anomaly_precision"] = m.get("anomaly_precision")
            row["anomaly_recall"] = m.get("anomaly_recall")
            row["anomaly_f1"] = m.get("anomaly_f1")
            row["roc_auc"] = m.get("roc_auc")
            row["threshold"] = m.get("threshold")
        rows.append(row)

    # ── Select best models ────────────────────────────────────────────────────
    # Best supervised = highest macro_f1 among RF + LSTM
    supervised = {
        name: m for name, m in metrics_map.items()
        if name in ("random_forest", "lstm")
    }
    best_supervised = None
    if supervised:
        best_supervised = max(
            supervised.keys(),
            key=lambda n: supervised[n].get("macro_f1") or 0.0,
        )

    # Best anomaly detector = autoencoder anomaly_f1 (if trained)
    best_anomaly = "autoencoder" if "autoencoder" in metrics_map else None

    return {
        "models": metrics_map,
        "comparison_table": rows,
        "best_supervised": best_supervised,
        "best_anomaly_detector": best_anomaly,
        "note": (
            "Best supervised model selected by Macro F1 (not accuracy) "
            "because the dataset is imbalanced. "
            "Autoencoder is evaluated separately as a binary anomaly detector."
        ),
    }
