"""
Database models and session management using SQLAlchemy async.
"""

from datetime import datetime
from typing import Optional
import json

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, Boolean, JSON
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from backend.config import settings


# ── Engine & Session ─────────────────────────────────────────────────────────
DATABASE_URL = f"sqlite+aiosqlite:///{settings.DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# ── ORM Models ───────────────────────────────────────────────────────────────

class ModelResult(Base):
    __tablename__ = "model_results"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(64), nullable=False, index=True)
    trained_at = Column(DateTime, default=datetime.utcnow)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    macro_f1 = Column(Float, nullable=True)
    weighted_f1 = Column(Float, nullable=True)
    training_time_s = Column(Float, nullable=True)
    inference_time_ms = Column(Float, nullable=True)
    n_samples_train = Column(Integer, nullable=True)
    n_samples_test = Column(Integer, nullable=True)
    n_features = Column(Integer, nullable=True)
    report_json = Column(Text, nullable=True)          # full classification report
    confusion_matrix_json = Column(Text, nullable=True)
    extra_metrics_json = Column(Text, nullable=True)   # model-specific extras
    is_demo = Column(Boolean, default=False)
    model_path = Column(String(512), nullable=True)


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    predicted_at = Column(DateTime, default=datetime.utcnow)
    model_name = Column(String(64), nullable=False)
    predicted_class = Column(String(128), nullable=True)
    confidence = Column(Float, nullable=True)
    anomaly_score = Column(Float, nullable=True)
    is_anomaly = Column(Boolean, default=False)
    risk_level = Column(String(32), default="NORMAL")
    source_ip = Column(String(64), nullable=True)
    dest_ip = Column(String(64), nullable=True)
    protocol = Column(String(32), nullable=True)
    src_port = Column(Integer, nullable=True)
    dst_port = Column(Integer, nullable=True)
    features_json = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    alert_type = Column(String(64), nullable=False)   # e.g. "DoS", "PortScan"
    risk_level = Column(String(32), default="MEDIUM")
    model_name = Column(String(64), nullable=True)
    confidence = Column(Float, nullable=True)
    anomaly_score = Column(Float, nullable=True)
    source_ip = Column(String(64), nullable=True)
    dest_ip = Column(String(64), nullable=True)
    protocol = Column(String(32), nullable=True)
    description = Column(Text, nullable=True)
    features_json = Column(Text, nullable=True)
    acknowledged = Column(Boolean, default=False)
    is_demo = Column(Boolean, default=False)


class DatasetInfo(Base):
    __tablename__ = "dataset_info"

    id = Column(Integer, primary_key=True, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    filename = Column(String(512), nullable=False)
    n_rows = Column(Integer, nullable=True)
    n_features = Column(Integer, nullable=True)
    label_distribution_json = Column(Text, nullable=True)
    preprocessing_config_json = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
