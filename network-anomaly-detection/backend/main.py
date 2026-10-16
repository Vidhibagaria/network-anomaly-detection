"""
FastAPI application entry point.

AI-Based Network Traffic Anomaly Detection System
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database.models import init_db
from backend.api.data import router as data_router
from backend.api.training import router as training_router
from backend.api.prediction import router as prediction_router
from backend.api.analytics import router as analytics_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("🚀 Starting AI Network Anomaly Detection System…")
    await init_db()
    logger.info("✅ Database initialized")
    yield
    logger.info("👋 Shutting down…")


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-Based Network Traffic Anomaly Detection System. "
        "Detects malicious network traffic using Random Forest, LSTM, and Autoencoder models "
        "trained on the CIC-IDS 2017 dataset."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = settings.API_PREFIX

app.include_router(data_router, prefix=PREFIX)
app.include_router(training_router, prefix=PREFIX)
app.include_router(prediction_router, prefix=PREFIX)
app.include_router(analytics_router, prefix=PREFIX)


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": f"{PREFIX}/health",
    }
