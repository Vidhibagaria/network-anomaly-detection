"""
Inference service: loads trained models and runs predictions on new data.
Supports single-sample, batch, and streaming modes.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.config import settings
from backend.models.random_forest import RandomForestModel
from backend.models.lstm_model import LSTMModel
from backend.models.autoencoder import AutoencoderModel
from backend.preprocessing.pipeline import PreprocessingPipeline, load_csv, detect_label_column

logger = logging.getLogger(__name__)


# ─── Risk level mapping ────────────────────────────────────────────────────────
ATTACK_RISK: Dict[str, str] = {
    "BENIGN": "NORMAL",
    "DoS": "HIGH",
    "DDoS": "CRITICAL",
    "PortScan": "MEDIUM",
    "Brute Force": "HIGH",
    "Web Attack": "HIGH",
    "Botnet": "CRITICAL",
    "Infiltration": "CRITICAL",
    "Heartbleed": "HIGH",
}


def _risk_level(predicted_class: str, confidence: float, is_anomaly: bool) -> str:
    if predicted_class.upper() == "BENIGN" and not is_anomaly:
        return "NORMAL"
    base = ATTACK_RISK.get(predicted_class, "MEDIUM")
    # Downgrade if low confidence
    if confidence < 0.5 and base in ("CRITICAL", "HIGH"):
        return "MEDIUM"
    return base


class InferenceService:
    """
    Handles loading models and running predictions.
    Models are lazily loaded and cached in memory.
    """

    def __init__(self):
        self._rf: Optional[RandomForestModel] = None
        self._lstm: Optional[LSTMModel] = None
        self._ae: Optional[AutoencoderModel] = None
        self._pipeline: Optional[PreprocessingPipeline] = None

    # ── Model loading ─────────────────────────────────────────────────────────

    def _load_pipeline(self) -> PreprocessingPipeline:
        if self._pipeline is None:
            self._pipeline = PreprocessingPipeline.load()
        return self._pipeline

    def load_random_forest(self) -> RandomForestModel:
        if self._rf is None:
            self._rf = RandomForestModel.load()
        return self._rf

    def load_lstm(self) -> LSTMModel:
        if self._lstm is None:
            self._lstm = LSTMModel.load()
        return self._lstm

    def load_autoencoder(self) -> AutoencoderModel:
        if self._ae is None:
            self._ae = AutoencoderModel.load()
        return self._ae

    def reload_all(self):
        """Force reload of all models (e.g. after retraining)."""
        self._rf = None
        self._lstm = None
        self._ae = None
        self._pipeline = None

    def available_models(self) -> Dict[str, bool]:
        rf_path = settings.MODELS_DIR / "random_forest.joblib"
        lstm_path = settings.MODELS_DIR / "lstm_model"
        ae_path = settings.MODELS_DIR / "autoencoder_model"
        pipeline_path = settings.MODELS_DIR / "preprocessing_pipeline.joblib"
        return {
            "random_forest": rf_path.exists(),
            "lstm": lstm_path.exists(),
            "autoencoder": ae_path.exists(),
            "pipeline": pipeline_path.exists(),
        }

    # ── Prediction methods ────────────────────────────────────────────────────

    def predict_with_model(
        self,
        model_name: str,
        X_scaled: np.ndarray,
        class_names: List[str],
    ) -> List[Dict[str, Any]]:
        """Run inference with a named model on already-scaled data."""
        results = []

        if model_name == "random_forest":
            model = self.load_random_forest()
            preds, probs = model.predict(X_scaled)
            for i in range(len(X_scaled)):
                cls_idx = int(preds[i])
                cls_name = class_names[cls_idx] if cls_idx < len(class_names) else "Unknown"
                conf = float(probs[i][cls_idx])
                is_anomaly = cls_name.upper() != "BENIGN"
                results.append({
                    "predicted_class": cls_name,
                    "confidence": conf,
                    "is_anomaly": is_anomaly,
                    "anomaly_score": float(1 - probs[i][0]) if len(probs[i]) > 0 else 0.0,
                    "risk_level": _risk_level(cls_name, conf, is_anomaly),
                    "all_probabilities": {
                        cn: float(p) for cn, p in zip(class_names, probs[i])
                    },
                })

        elif model_name == "lstm":
            model = self.load_lstm()
            if len(X_scaled) < model.sequence_length:
                # Pad to minimum required length
                padding = np.zeros(
                    (model.sequence_length - len(X_scaled), X_scaled.shape[1]),
                    dtype=np.float32
                )
                X_scaled = np.vstack([padding, X_scaled])

            preds, probs = model.predict(X_scaled)
            # preds has length = n_samples - seq_len + 1; pad front with first result
            n_pad = len(X_scaled) - len(preds)
            preds = np.concatenate([[preds[0]] * n_pad, preds])
            probs = np.vstack([np.tile(probs[0], (n_pad, 1)), probs])

            for i in range(len(X_scaled)):
                cls_idx = int(preds[i])
                cls_name = class_names[cls_idx] if cls_idx < len(class_names) else "Unknown"
                conf = float(probs[i][cls_idx])
                is_anomaly = cls_name.upper() != "BENIGN"
                results.append({
                    "predicted_class": cls_name,
                    "confidence": conf,
                    "is_anomaly": is_anomaly,
                    "anomaly_score": float(1 - probs[i][0]) if len(probs[i]) > 0 else 0.0,
                    "risk_level": _risk_level(cls_name, conf, is_anomaly),
                    "all_probabilities": {
                        cn: float(p) for cn, p in zip(class_names, probs[i])
                    },
                })

        elif model_name == "autoencoder":
            model = self.load_autoencoder()
            is_anomaly_arr, errors = model.predict(X_scaled)
            for i in range(len(X_scaled)):
                is_anom = bool(is_anomaly_arr[i])
                cls_name = "ANOMALY" if is_anom else "NORMAL"
                conf = float(
                    min(errors[i] / (model.threshold * 2 + 1e-9), 1.0)
                    if is_anom else
                    1 - errors[i] / (model.threshold + 1e-9)
                )
                results.append({
                    "predicted_class": cls_name,
                    "confidence": round(max(0.0, min(1.0, conf)), 4),
                    "is_anomaly": is_anom,
                    "anomaly_score": float(errors[i]),
                    "risk_level": "HIGH" if is_anom else "NORMAL",
                    "threshold": model.threshold,
                    "note": "Autoencoder detects anomalies only; does not identify attack type.",
                })
        else:
            raise ValueError(f"Unknown model: {model_name}")

        return results

    def predict_from_csv(
        self,
        csv_path: Path,
        model_name: str,
        nrows: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Load a CSV, apply the saved preprocessing pipeline,
        run inference, and return structured results.
        """
        pipeline = self._load_pipeline()
        df = load_csv(csv_path, nrows=nrows)

        # Extract metadata columns before transforming
        meta_cols = {}
        for col in ["Source IP", " Source IP", "Destination IP", " Destination IP",
                    "Protocol", " Protocol", "Source Port", " Source Port",
                    "Destination Port", " Destination Port", "Timestamp", " Timestamp"]:
            col_stripped = col.strip()
            if col in df.columns:
                meta_cols[col_stripped] = df[col].tolist()

        X_scaled, y_enc = pipeline.transform(df)
        class_names = pipeline.get_label_names()

        t0 = time.time()
        predictions = self.predict_with_model(model_name, X_scaled, class_names)
        inference_time = time.time() - t0

        # Merge with metadata
        for i, pred in enumerate(predictions):
            pred["row_index"] = i
            for k, vals in meta_cols.items():
                if i < len(vals):
                    pred[k.lower().replace(" ", "_")] = vals[i]
            # True label if available
            if y_enc is not None and i < len(y_enc) and len(class_names) > y_enc[i]:
                pred["true_label"] = class_names[y_enc[i]]

        # Summary stats
        anomaly_count = sum(1 for p in predictions if p["is_anomaly"])
        attack_counts: Dict[str, int] = {}
        for p in predictions:
            cls = p["predicted_class"]
            attack_counts[cls] = attack_counts.get(cls, 0) + 1

        return {
            "model_name": model_name,
            "n_predictions": len(predictions),
            "n_anomalies": anomaly_count,
            "anomaly_rate": round(anomaly_count / max(len(predictions), 1), 4),
            "inference_time_s": round(inference_time, 3),
            "attack_distribution": attack_counts,
            "predictions": predictions,
        }

    def stream_predictions(
        self,
        csv_path: Path,
        model_name: str,
        batch_size: int = 1,
    ):
        """
        Generator that yields prediction results row-by-row (or in small batches).
        Used by the real-time streaming endpoint.
        """
        pipeline = self._load_pipeline()
        df = load_csv(csv_path)
        class_names = pipeline.get_label_names()

        # Process in chunks
        for start in range(0, len(df), batch_size):
            chunk = df.iloc[start:start + batch_size]
            X_scaled, _ = pipeline.transform(chunk.copy())

            preds = self.predict_with_model(model_name, X_scaled, class_names)

            for i, pred in enumerate(preds):
                row = chunk.iloc[i] if i < len(chunk) else chunk.iloc[-1]
                pred["row_index"] = start + i
                pred["source_ip"] = str(row.get("Source IP", row.get(" Source IP", "N/A")))
                pred["dest_ip"] = str(row.get("Destination IP", row.get(" Destination IP", "N/A")))
                pred["protocol"] = str(row.get("Protocol", row.get(" Protocol", "N/A")))
                pred["src_port"] = str(row.get("Source Port", row.get(" Source Port", "N/A")))
                pred["dst_port"] = str(row.get("Destination Port", row.get(" Destination Port", "N/A")))
                yield pred


# Singleton
inference_service = InferenceService()
