"""
Data Preprocessing Pipeline for CIC-IDS 2017.

Follows the correct order:
  raw → clean → split → fit on train → transform test → SMOTE on train only
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
from imblearn.over_sampling import SMOTE
from imblearn.under_sampling import RandomUnderSampler
from imblearn.pipeline import Pipeline as ImbPipeline

from backend.config import settings

logger = logging.getLogger(__name__)

# ── Known CIC-IDS label normalization map ────────────────────────────────────
LABEL_MAP: Dict[str, str] = {
    "benign": "BENIGN",
    "dos hulk": "DoS",
    "dos goldeneye": "DoS",
    "dos slowloris": "DoS",
    "dos slowhttptest": "DoS",
    "ddos": "DDoS",
    "portscan": "PortScan",
    "ftp-patator": "Brute Force",
    "ssh-patator": "Brute Force",
    "web attack – brute force": "Web Attack",
    "web attack – xss": "Web Attack",
    "web attack – sql injection": "Web Attack",
    "web attack brute force": "Web Attack",
    "web attack xss": "Web Attack",
    "web attack sql injection": "Web Attack",
    "bot": "Botnet",
    "infiltration": "Infiltration",
    "heartbleed": "Heartbleed",
}

# Columns that are usually non-numeric / identifiers in CIC-IDS
NON_FEATURE_COLUMNS = [
    "Flow ID", "Source IP", "Destination IP", "Timestamp",
    " Source IP", " Destination IP", " Timestamp", " Flow ID",
]


class PreprocessingPipeline:
    """
    End-to-end preprocessing pipeline.

    Attributes saved to disk (joblib):
      - scaler (MinMaxScaler)
      - label_encoder (LabelEncoder)
      - feature_columns (list[str])
      - config (dict)
    """

    ARTIFACT_NAME = "preprocessing_pipeline.joblib"

    def __init__(self, config: Optional[Dict] = None):
        self.config: Dict[str, Any] = config or {}
        self.scaler: Optional[MinMaxScaler] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self.feature_columns: List[str] = []
        self.label_column: str = settings.LABEL_COLUMN
        self.random_seed: int = settings.RANDOM_SEED
        self.test_size: float = settings.TEST_SIZE
        self.preprocessing_log: List[str] = []
        self._is_fitted: bool = False

    # ── Public API ───────────────────────────────────────────────────────────

    def run(
        self,
        df: pd.DataFrame,
        label_column: Optional[str] = None,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray,
               np.ndarray, np.ndarray]:
        """
        Full pipeline: clean → split → fit/transform → return arrays.

        Returns:
            X_train, X_test, y_train, y_test, X_train_smote, y_train_smote
        """
        t0 = time.time()
        if label_column:
            self.label_column = label_column

        self._log("=== Preprocessing Pipeline Start ===")
        df = self._clean(df)
        X, y_raw = self._split_features_labels(df)
        y = self._encode_labels(y_raw, fit=True)
        X_train, X_test, y_train, y_test = self._train_test_split(X, y)
        X_train_sc, X_test_sc = self._fit_scale(X_train, X_test)
        X_train_sm, y_train_sm = self._apply_class_balancing(X_train_sc, y_train)

        elapsed = time.time() - t0
        self._log(f"Pipeline done in {elapsed:.1f}s")
        self._is_fitted = True

        self.config.update({
            "n_total": len(df),
            "n_train": len(X_train),
            "n_test": len(X_test),
            "n_train_after_smote": len(X_train_sm),
            "n_features": len(self.feature_columns),
            "label_column": self.label_column,
            "classes": list(self.label_encoder.classes_),
            "elapsed_s": round(elapsed, 2),
        })

        return X_train_sc, X_test_sc, y_train, y_test, X_train_sm, y_train_sm

    def transform(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Apply the FITTED pipeline to new data.
        Returns (X_scaled, y_encoded) – y_encoded will be all-zeros if label col absent.
        """
        if not self._is_fitted:
            raise RuntimeError("Pipeline not fitted. Call run() first or load from disk.")

        df = self._clean(df, inference=True)
        X, y_raw = self._split_features_labels(df, inference=True)

        # Fill missing feature columns with 0
        for col in self.feature_columns:
            if col not in X.columns:
                X[col] = 0.0
        X = X[self.feature_columns]

        X_arr = X.values.astype(np.float32)
        X_scaled = self.scaler.transform(X_arr)

        if y_raw is not None:
            y_enc = self._encode_labels(y_raw, fit=False)
        else:
            y_enc = np.zeros(len(X_scaled), dtype=int)

        return X_scaled, y_enc

    def save(self, path: Optional[Path] = None) -> Path:
        """Serialize pipeline artifacts to disk."""
        path = path or (settings.MODELS_DIR / self.ARTIFACT_NAME)
        payload = {
            "scaler": self.scaler,
            "label_encoder": self.label_encoder,
            "feature_columns": self.feature_columns,
            "label_column": self.label_column,
            "config": self.config,
        }
        joblib.dump(payload, path)
        self._log(f"Pipeline saved to {path}")
        return path

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "PreprocessingPipeline":
        """Deserialize pipeline from disk."""
        path = path or (settings.MODELS_DIR / cls.ARTIFACT_NAME)
        payload = joblib.load(path)
        inst = cls(config=payload["config"])
        inst.scaler = payload["scaler"]
        inst.label_encoder = payload["label_encoder"]
        inst.feature_columns = payload["feature_columns"]
        inst.label_column = payload["label_column"]
        inst._is_fitted = True
        return inst

    def get_label_names(self) -> List[str]:
        if self.label_encoder:
            return list(self.label_encoder.classes_)
        return []

    def decode_labels(self, y: np.ndarray) -> List[str]:
        return list(self.label_encoder.inverse_transform(y))

    # ── Private helpers ──────────────────────────────────────────────────────

    def _log(self, msg: str):
        logger.info(msg)
        self.preprocessing_log.append(msg)

    def _clean(self, df: pd.DataFrame, inference: bool = False) -> pd.DataFrame:
        """Clean raw DataFrame."""
        original_rows = len(df)
        self._log(f"Input rows: {original_rows}, columns: {len(df.columns)}")

        # Strip whitespace from column names
        df.columns = df.columns.str.strip()

        # Drop known non-feature identifier columns
        cols_to_drop = [c for c in NON_FEATURE_COLUMNS if c in df.columns]
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
            self._log(f"Dropped identifier columns: {cols_to_drop}")

        # Drop duplicates (not during inference to keep row order)
        if not inference:
            before = len(df)
            df = df.drop_duplicates()
            self._log(f"Removed {before - len(df)} duplicate rows")

        # Replace inf/-inf with NaN
        df = df.replace([np.inf, -np.inf], np.nan)
        inf_count = df.isnull().sum().sum()
        self._log(f"Replaced inf values; NaN count after: {inf_count}")

        # Drop rows where label is NaN (during training)
        if not inference and self.label_column in df.columns:
            before = len(df)
            df = df.dropna(subset=[self.label_column])
            self._log(f"Dropped {before - len(df)} rows with null label")

        # Convert all feature columns to numeric
        feat_cols = [c for c in df.columns if c != self.label_column]
        for col in feat_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # Fill remaining NaN in features with column median
        nan_cols = df[feat_cols].columns[df[feat_cols].isnull().any()].tolist()
        if nan_cols:
            df[feat_cols] = df[feat_cols].fillna(df[feat_cols].median(numeric_only=True))
            self._log(f"Imputed NaN with median in {len(nan_cols)} columns: {nan_cols[:5]}...")

        # Drop columns that are still all-NaN after median fill
        all_nan = [c for c in feat_cols if df[c].isnull().all()]
        if all_nan:
            df = df.drop(columns=all_nan)
            self._log(f"Dropped all-NaN columns: {all_nan}")

        # Drop constant columns (zero variance) — only during training
        if not inference:
            const_cols = [c for c in feat_cols
                          if c in df.columns and df[c].nunique() <= 1]
            if const_cols:
                df = df.drop(columns=const_cols)
                self._log(f"Dropped constant columns: {const_cols}")

        self._log(f"After cleaning: {len(df)} rows, {len(df.columns)} columns")
        return df

    def _split_features_labels(
        self,
        df: pd.DataFrame,
        inference: bool = False,
    ) -> Tuple[pd.DataFrame, Optional[pd.Series]]:
        """Separate X and y."""
        if self.label_column in df.columns:
            y = df[self.label_column]
            X = df.drop(columns=[self.label_column])
        else:
            y = None
            X = df

        # During training, record the feature columns
        if not inference and not self._is_fitted:
            self.feature_columns = list(X.columns)
            self._log(f"Feature columns selected: {len(self.feature_columns)}")

        return X, y

    def _normalize_label(self, lbl: str) -> str:
        """Normalize CIC-IDS label to canonical form."""
        return LABEL_MAP.get(str(lbl).strip().lower(), str(lbl).strip())

    def _encode_labels(self, y: pd.Series, fit: bool) -> np.ndarray:
        """Normalize then encode labels."""
        y_norm = y.map(self._normalize_label)
        if fit:
            self.label_encoder = LabelEncoder()
            encoded = self.label_encoder.fit_transform(y_norm)
            self._log(f"Label classes: {list(self.label_encoder.classes_)}")
        else:
            # Handle unseen labels gracefully
            known = set(self.label_encoder.classes_)
            y_norm = y_norm.map(lambda x: x if x in known else "BENIGN")
            encoded = self.label_encoder.transform(y_norm)
        return encoded.astype(np.int32)

    def _train_test_split(
        self, X: pd.DataFrame, y: np.ndarray
    ) -> Tuple[pd.DataFrame, pd.DataFrame, np.ndarray, np.ndarray]:
        """Stratified train/test split."""
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y,
            test_size=self.test_size,
            random_state=self.random_seed,
            stratify=y,
        )
        self._log(f"Train: {len(X_tr)}, Test: {len(X_te)}")
        return X_tr, X_te, y_tr, y_te

    def _fit_scale(
        self, X_train: pd.DataFrame, X_test: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Fit MinMaxScaler on training data only, then transform both."""
        self.scaler = MinMaxScaler()
        X_tr_arr = X_train.values.astype(np.float32)
        X_te_arr = X_test.values.astype(np.float32)
        X_tr_sc = self.scaler.fit_transform(X_tr_arr)
        X_te_sc = self.scaler.transform(X_te_arr)
        self._log("MinMaxScaler fitted on training data and applied to test data")
        return X_tr_sc, X_te_sc

    def _apply_class_balancing(
        self, X_train: np.ndarray, y_train: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Apply SMOTE to training data only.
        Uses a combination of SMOTE + RandomUnderSampler to be memory-efficient.
        Falls back gracefully if minority classes are too small.
        """
        class_counts = pd.Series(y_train).value_counts()
        self._log(f"Class distribution before SMOTE: {class_counts.to_dict()}")

        # Only SMOTE classes with ≥ k_neighbors samples
        k_neighbors = 5
        valid_classes = class_counts[class_counts >= k_neighbors + 1].index.tolist()
        invalid_classes = class_counts[class_counts < k_neighbors + 1].index.tolist()

        if invalid_classes:
            self._log(
                f"Classes too small for SMOTE (will keep as-is): "
                f"{[self.label_encoder.classes_[i] for i in invalid_classes]}"
            )

        if len(valid_classes) < 2:
            self._log("Skipping SMOTE – insufficient class diversity")
            return X_train, y_train

        try:
            # Target: oversample minorities to 10% of majority, cap majority at 3x minority
            majority_count = class_counts.max()
            smote_strategy = {
                cls: max(count, min(majority_count // 5, 50000))
                for cls, count in class_counts.items()
                if cls in valid_classes and count < majority_count
            }

            if smote_strategy:
                smote = SMOTE(
                    sampling_strategy=smote_strategy,
                    k_neighbors=k_neighbors,
                    random_state=self.random_seed,
                )
                X_sm, y_sm = smote.fit_resample(X_train, y_train)
                self._log(
                    f"After SMOTE: {len(X_sm)} samples "
                    f"(was {len(X_train)})"
                )
                return X_sm, y_sm
            else:
                self._log("SMOTE not needed (all classes balanced)")
                return X_train, y_train

        except Exception as exc:
            self._log(f"SMOTE failed ({exc}), using original training data")
            return X_train, y_train


# ── Utility: load CSV ─────────────────────────────────────────────────────────

def load_csv(path: Path, nrows: Optional[int] = None) -> pd.DataFrame:
    """Load a CSV file with robust encoding detection."""
    for enc in ["utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(path, nrows=nrows, encoding=enc, low_memory=False)
            logger.info(f"Loaded {path.name}: {len(df)} rows, {len(df.columns)} cols (enc={enc})")
            return df
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Cannot decode {path}")


def detect_label_column(df: pd.DataFrame) -> str:
    """Heuristically detect the label column from a CIC-IDS CSV."""
    candidates = [" Label", "Label", "label", "Class", "class", "Attack"]
    for c in candidates:
        if c in df.columns:
            return c.strip()
    # fallback: last column
    return df.columns[-1].strip()
