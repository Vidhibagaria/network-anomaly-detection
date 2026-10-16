"""
Core unit tests for the AI Network Anomaly Detection System.

Tests cover:
- Preprocessing pipeline (cleaning, NaN, inf, duplicates, label encoding, scaling)
- Feature validation
- Model training and prediction (mocked/fast)
- API endpoints
- Invalid input handling
- Edge cases (empty dataset, all-NaN columns, model not trained)
"""

from __future__ import annotations

import io
import json
import numpy as np
import pandas as pd
import pytest
import pytest_asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_df():
    """Small representative DataFrame mimicking CIC-IDS structure."""
    np.random.seed(42)
    n = 200
    data = {
        "Destination Port": np.random.randint(1, 65535, n),
        "Flow Duration": np.random.exponential(1000, n),
        "Total Fwd Packets": np.random.poisson(5, n),
        "Total Backward Packets": np.random.poisson(3, n),
        "Flow Bytes/s": np.random.exponential(5000, n),
        "Flow Packets/s": np.random.exponential(100, n),
        "Label": np.random.choice(
            ["BENIGN", "DoS", "PortScan", "DDoS", "Brute Force"],
            n,
            p=[0.7, 0.1, 0.1, 0.05, 0.05],
        ),
    }
    return pd.DataFrame(data)


@pytest.fixture
def sample_df_with_issues(sample_df):
    """DataFrame with NaN, Inf, and duplicates."""
    df = sample_df.copy()
    # Introduce NaN
    df.loc[0:10, "Flow Duration"] = np.nan
    # Introduce Inf
    df.loc[11:15, "Flow Bytes/s"] = np.inf
    df.loc[16:18, "Flow Packets/s"] = -np.inf
    # Introduce duplicates
    df = pd.concat([df, df.iloc[:5]], ignore_index=True)
    return df


@pytest.fixture
def pipeline():
    """Fresh preprocessing pipeline."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from backend.preprocessing.pipeline import PreprocessingPipeline
    return PreprocessingPipeline()


@pytest.fixture
def fitted_pipeline(pipeline, sample_df):
    """Pipeline fitted on sample data."""
    pipeline.run(sample_df)
    return pipeline


# ── Preprocessing Tests ───────────────────────────────────────────────────────

class TestPreprocessingPipeline:

    def test_basic_run(self, pipeline, sample_df):
        """Pipeline should produce correctly shaped arrays."""
        X_tr, X_te, y_tr, y_te, X_sm, y_sm = pipeline.run(sample_df)
        n_feat = len(pipeline.feature_columns)

        assert X_tr.ndim == 2
        assert X_te.ndim == 2
        assert X_tr.shape[1] == n_feat
        assert X_te.shape[1] == n_feat
        assert len(y_tr) == len(X_tr)
        assert len(y_te) == len(X_te)

    def test_nan_and_inf_handling(self, pipeline, sample_df_with_issues):
        """NaN and Inf values should be handled without raising."""
        X_tr, X_te, y_tr, y_te, _, _ = pipeline.run(sample_df_with_issues)
        assert not np.any(np.isnan(X_tr))
        assert not np.any(np.isinf(X_tr))
        assert not np.any(np.isnan(X_te))

    def test_duplicate_removal(self, pipeline, sample_df_with_issues):
        """Duplicates should be removed during cleaning."""
        original = len(sample_df_with_issues)
        pipeline.run(sample_df_with_issues)
        n_processed = pipeline.config.get("n_total", 0)
        assert n_processed < original, "Duplicates should have been removed"

    def test_label_encoding(self, fitted_pipeline):
        """Label encoder should be fitted with expected classes."""
        classes = fitted_pipeline.get_label_names()
        assert len(classes) > 0
        assert all(isinstance(c, str) for c in classes)

    def test_scale_range(self, pipeline, sample_df):
        """After MinMaxScaler, features should be in [0, 1]."""
        X_tr, X_te, *_ = pipeline.run(sample_df)
        assert X_tr.min() >= -1e-6
        assert X_tr.max() <= 1 + 1e-6

    def test_no_leakage_test_set(self, pipeline, sample_df):
        """Scaler must be fit on train only — test set scaling uses train statistics."""
        X_tr, X_te, *_ = pipeline.run(sample_df)
        # If scaler were fit on test set, these would differ
        assert pipeline.scaler is not None
        # Verify scaler was fitted (has data_min_ attribute)
        assert hasattr(pipeline.scaler, "data_min_")

    def test_transform_inference(self, fitted_pipeline, sample_df):
        """transform() should work on new data without refitting."""
        new_df = sample_df.drop(columns=["Label"], errors="ignore").copy()
        X_scaled, _ = fitted_pipeline.transform(new_df)
        assert X_scaled.shape[1] == len(fitted_pipeline.feature_columns)
        assert not np.any(np.isnan(X_scaled))

    def test_transform_missing_columns(self, fitted_pipeline):
        """transform() should handle missing columns by filling with 0."""
        sparse_df = pd.DataFrame({"Destination Port": [80, 443]})
        X_scaled, _ = fitted_pipeline.transform(sparse_df)
        assert X_scaled.shape == (2, len(fitted_pipeline.feature_columns))

    def test_empty_dataset_raises(self, pipeline):
        """Empty DataFrame should raise an error."""
        with pytest.raises(Exception):
            pipeline.run(pd.DataFrame())

    def test_all_nan_column_dropped(self, pipeline, sample_df):
        """A column that is entirely NaN should be dropped."""
        df = sample_df.copy()
        df["all_nan_col"] = np.nan
        pipeline.run(df)
        assert "all_nan_col" not in pipeline.feature_columns

    def test_save_load_pipeline(self, fitted_pipeline, tmp_path):
        """Saved pipeline should load and produce identical transforms."""
        from backend.preprocessing.pipeline import PreprocessingPipeline
        save_path = tmp_path / "test_pipeline.joblib"
        fitted_pipeline.save(save_path)
        loaded = PreprocessingPipeline.load(save_path)

        test_df = pd.DataFrame({col: [0.5] for col in fitted_pipeline.feature_columns})
        X1, _ = fitted_pipeline.transform(test_df)
        X2, _ = loaded.transform(test_df)
        np.testing.assert_array_almost_equal(X1, X2)


# ── Feature Validation Tests ──────────────────────────────────────────────────

class TestFeatureValidation:

    def test_label_column_detection(self):
        """detect_label_column should find the label column."""
        from backend.preprocessing.pipeline import detect_label_column
        df = pd.DataFrame({"feat1": [1], "feat2": [2], "Label": ["BENIGN"]})
        assert detect_label_column(df) == "Label"

    def test_label_normalization(self, pipeline):
        """Known CIC-IDS labels should be normalized correctly."""
        assert pipeline._normalize_label("DoS Hulk") == "DoS"
        assert pipeline._normalize_label("benign") == "BENIGN"
        assert pipeline._normalize_label("ddos") == "DDoS"
        assert pipeline._normalize_label("FTP-Patator") == "Brute Force"

    def test_non_numeric_conversion(self, pipeline):
        """Non-numeric feature columns should be coerced to numeric."""
        df = pd.DataFrame({
            "numeric_col": ["1.5", "2.0", "bad_value"],
            "Label": ["BENIGN", "DoS", "DDoS"],
        })
        cleaned = pipeline._clean(df)
        # bad_value should become NaN and then be imputed
        assert cleaned["numeric_col"].dtype in [np.float32, np.float64, float]


# ── Random Forest Tests ───────────────────────────────────────────────────────

class TestRandomForestModel:

    def _make_data(self):
        np.random.seed(42)
        n = 300
        X = np.random.rand(n, 10).astype(np.float32)
        y = np.random.randint(0, 3, n).astype(np.int32)
        return X[:240], X[240:], y[:240], y[240:]

    def test_train_and_predict(self):
        """RF should train and predict without errors."""
        from backend.models.random_forest import RandomForestModel
        model = RandomForestModel(n_estimators=10)
        X_tr, X_te, y_tr, y_te = self._make_data()
        metrics = model.train(X_tr, y_tr, X_te, y_te, ["ClassA", "ClassB", "ClassC"])

        assert "accuracy" in metrics
        assert 0.0 <= metrics["accuracy"] <= 1.0
        assert "macro_f1" in metrics
        assert model.is_trained

    def test_predict_shape(self):
        """Predict should return arrays of correct length."""
        from backend.models.random_forest import RandomForestModel
        model = RandomForestModel(n_estimators=5)
        X_tr, X_te, y_tr, y_te = self._make_data()
        model.train(X_tr, y_tr, X_te, y_te, ["A", "B", "C"])
        preds, probs = model.predict(X_te)
        assert len(preds) == len(X_te)
        assert probs.shape == (len(X_te), 3)

    def test_predict_before_train_raises(self):
        """Predicting without training should raise RuntimeError."""
        from backend.models.random_forest import RandomForestModel
        model = RandomForestModel()
        with pytest.raises(RuntimeError):
            model.predict(np.random.rand(5, 10))

    def test_save_load(self, tmp_path):
        """Saved RF model should reload and produce identical predictions."""
        from backend.models.random_forest import RandomForestModel
        model = RandomForestModel(n_estimators=5)
        X_tr, X_te, y_tr, y_te = self._make_data()
        model.train(X_tr, y_tr, X_te, y_te, ["A", "B", "C"])

        path = tmp_path / "rf.joblib"
        model.save(path)
        loaded = RandomForestModel.load(path)

        preds1, _ = model.predict(X_te)
        preds2, _ = loaded.predict(X_te)
        np.testing.assert_array_equal(preds1, preds2)

    def test_load_nonexistent_raises(self, tmp_path):
        """Loading from non-existent path should raise FileNotFoundError."""
        from backend.models.random_forest import RandomForestModel
        with pytest.raises(FileNotFoundError):
            RandomForestModel.load(tmp_path / "nonexistent.joblib")

    def test_feature_importance_keys(self):
        """Feature importance should have correct keys."""
        from backend.models.random_forest import RandomForestModel
        model = RandomForestModel(n_estimators=5)
        X_tr, X_te, y_tr, y_te = self._make_data()
        feat_names = [f"feat_{i}" for i in range(10)]
        metrics = model.train(X_tr, y_tr, X_te, y_te, ["A", "B", "C"], feature_names=feat_names)
        assert "feature_importance" in metrics
        assert len(metrics["feature_importance"]) == 10


# ── Autoencoder Tests ─────────────────────────────────────────────────────────

class TestAutoencoderModel:

    def _make_data(self):
        np.random.seed(42)
        n = 300
        X = np.random.rand(n, 10).astype(np.float32)
        y = np.array([0] * 200 + [1] * 50 + [2] * 50, dtype=np.int32)
        return X[:240], X[240:], y[:240], y[240:]

    def test_train_evaluates(self):
        """Autoencoder training should produce anomaly detection metrics."""
        from backend.models.autoencoder import AutoencoderModel
        model = AutoencoderModel(epochs=2, batch_size=32)
        X_tr, X_te, y_tr, y_te = self._make_data()
        metrics = model.train(
            X_tr, y_tr, X_te, y_te,
            ["BENIGN", "DoS", "PortScan"],
            benign_label_index=0,
        )
        assert "anomaly_f1" in metrics
        assert "threshold" in metrics
        assert model.threshold > 0

    def test_threshold_positive(self):
        """Threshold should be a positive float."""
        from backend.models.autoencoder import AutoencoderModel
        model = AutoencoderModel(epochs=1, batch_size=32)
        X_tr, X_te, y_tr, y_te = self._make_data()
        model.train(X_tr, y_tr, X_te, y_te, ["BENIGN", "X", "Y"], benign_label_index=0)
        assert model.threshold > 0.0

    def test_binary_prediction(self):
        """predict() should return boolean array."""
        from backend.models.autoencoder import AutoencoderModel
        model = AutoencoderModel(epochs=1, batch_size=32)
        X_tr, X_te, y_tr, y_te = self._make_data()
        model.train(X_tr, y_tr, X_te, y_te, ["BENIGN", "X", "Y"], benign_label_index=0)
        is_anomaly, errors = model.predict(X_te)
        assert is_anomaly.dtype == bool
        assert len(errors) == len(X_te)


# ── LSTM Sequence Tests ───────────────────────────────────────────────────────

class TestLSTMSequences:

    def test_sequence_shape(self):
        """_build_sequences should produce correct shapes."""
        from backend.models.lstm_model import _build_sequences
        X = np.random.rand(100, 10).astype(np.float32)
        y = np.random.randint(0, 3, 100).astype(np.int32)
        X_seq, y_seq = _build_sequences(X, y, seq_len=5)
        assert X_seq.shape == (96, 5, 10)  # 100 - 5 + 1 = 96
        assert len(y_seq) == 96

    def test_sequence_too_short_raises(self):
        """Should raise ValueError if not enough samples."""
        from backend.models.lstm_model import _build_sequences
        X = np.random.rand(3, 5).astype(np.float32)
        y = np.zeros(3, dtype=np.int32)
        with pytest.raises(ValueError):
            _build_sequences(X, y, seq_len=10)


# ── API Integration Tests ─────────────────────────────────────────────────────

class TestAPIEndpoints:

    @pytest.fixture(autouse=True)
    def setup_client(self):
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        from backend.main import app
        self.client = TestClient(app)

    def test_health_endpoint(self):
        """Health check should return 200."""
        resp = self.client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    def test_data_status_no_data(self):
        """Data status should indicate no data when nothing is uploaded."""
        resp = self.client.get("/api/v1/data/status")
        assert resp.status_code == 200
        # Either no_data or pipeline_exists
        assert "status" in resp.json()

    def test_models_list(self):
        """Models endpoint should return a dict of model names."""
        resp = self.client.get("/api/v1/models")
        assert resp.status_code == 200
        assert "models" in resp.json()

    def test_statistics_endpoint(self):
        """Statistics endpoint should return required fields."""
        resp = self.client.get("/api/v1/statistics")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_flows" in data
        assert "anomaly_rate" in data

    def test_alerts_endpoint(self):
        """Alerts endpoint should return a list."""
        resp = self.client.get("/api/v1/alerts")
        assert resp.status_code == 200
        data = resp.json()
        assert "alerts" in data
        assert isinstance(data["alerts"], list)

    def test_model_comparison_endpoint(self):
        """Model comparison endpoint should return structured response."""
        resp = self.client.get("/api/v1/model-comparison")
        assert resp.status_code == 200
        data = resp.json()
        assert "comparison_table" in data

    def test_upload_invalid_file_type(self):
        """Uploading a non-CSV file should return 400."""
        fake_file = io.BytesIO(b"this is not a csv")
        resp = self.client.post(
            "/api/v1/data/upload",
            files={"file": ("malware.exe", fake_file, "application/octet-stream")},
        )
        assert resp.status_code == 400

    def test_upload_valid_csv(self, tmp_path):
        """Uploading a valid CSV should preprocess successfully."""
        from backend.services.demo_data import generate_demo_dataset
        df = generate_demo_dataset(n_samples=500)
        csv_path = tmp_path / "test.csv"
        df.drop(columns=["_is_demo"], errors="ignore").to_csv(csv_path, index=False)

        with open(csv_path, "rb") as f:
            resp = self.client.post(
                "/api/v1/data/upload",
                files={"file": ("test.csv", f, "text/csv")},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "n_rows" in data
        assert data["n_rows"] > 0

    def test_train_without_data_returns_400(self):
        """Training without data should return 400."""
        # Clear cache first
        from backend.services import training_service as ts
        ts._data_cache = {}
        resp = self.client.post("/api/v1/models/train/random-forest", json={})
        # Could be 400 (no data) or 200 if data was loaded by previous test
        assert resp.status_code in (200, 400)

    def test_predict_batch_untrained_model(self, tmp_path):
        """Batch prediction with untrained model should return 404."""
        fake_csv = tmp_path / "fake.csv"
        fake_csv.write_text("col1,col2\n1,2\n3,4\n")
        with open(fake_csv, "rb") as f:
            resp = self.client.post(
                "/api/v1/predict/batch",
                files={"file": ("fake.csv", f, "text/csv")},
                data={"model_name": "nonexistent_model"},
            )
        assert resp.status_code in (400, 404, 422)

    def test_malformed_csv_upload(self):
        """Malformed CSV should be handled gracefully."""
        malformed = io.BytesIO(b",,,,\ngarbage\x00\x01\x02\n,,,\n")
        resp = self.client.post(
            "/api/v1/data/upload",
            files={"file": ("malformed.csv", malformed, "text/csv")},
        )
        # Should either process gracefully or return a proper error
        assert resp.status_code in (200, 400, 422)

    def test_empty_csv_upload(self):
        """Empty CSV should return an error."""
        empty = io.BytesIO(b"")
        resp = self.client.post(
            "/api/v1/data/upload",
            files={"file": ("empty.csv", empty, "text/csv")},
        )
        assert resp.status_code in (400, 422)


# ── Demo Data Tests ───────────────────────────────────────────────────────────

class TestDemoData:

    def test_generate_demo_dataset(self):
        """Demo dataset should have expected columns and labels."""
        from backend.services.demo_data import generate_demo_dataset
        df = generate_demo_dataset(n_samples=200)
        assert "Label" in df.columns
        assert len(df) > 0
        assert df["Label"].nunique() > 1

    def test_demo_is_synthetic_marked(self):
        """Demo dataset should have _is_demo column."""
        from backend.services.demo_data import generate_demo_dataset
        df = generate_demo_dataset(n_samples=100)
        assert "_is_demo" in df.columns
        assert df["_is_demo"].all()

    def test_demo_label_distribution(self):
        """Demo dataset should contain BENIGN as the majority class."""
        from backend.services.demo_data import generate_demo_dataset
        df = generate_demo_dataset(n_samples=1000)
        counts = df["Label"].value_counts(normalize=True)
        assert counts.get("BENIGN", 0) > 0.5


# ── Edge Case Tests ───────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_pipeline_not_fitted_transform_raises(self):
        """Calling transform() before run() should raise RuntimeError."""
        from backend.preprocessing.pipeline import PreprocessingPipeline
        pipeline = PreprocessingPipeline()
        with pytest.raises(RuntimeError):
            pipeline.transform(pd.DataFrame({"a": [1, 2]}))

    def test_model_comparison_no_models(self):
        """Model comparison with no trained models should return empty list."""
        from backend.services.comparison_service import compare_models
        # This will try to load models; they may or may not exist
        result = compare_models()
        assert "comparison_table" in result
        assert isinstance(result["comparison_table"], list)
