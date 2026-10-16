"""
Statistics, alerts, and model comparison API endpoints.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, desc, func

from backend.database.models import AsyncSessionLocal, Alert, Prediction, ModelResult
from backend.services.comparison_service import compare_models

router = APIRouter(tags=["Analytics"])


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/alerts")
async def get_alerts(
    limit: int = Query(default=100, ge=1, le=500),
    risk_level: Optional[str] = Query(default=None),
    acknowledged: Optional[bool] = Query(default=None),
):
    """List recent alerts from the database."""
    async with AsyncSessionLocal() as db:
        stmt = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
        if risk_level:
            stmt = stmt.where(Alert.risk_level == risk_level.upper())
        if acknowledged is not None:
            stmt = stmt.where(Alert.acknowledged == acknowledged)
        result = await db.execute(stmt)
        alerts = result.scalars().all()
        return {
            "count": len(alerts),
            "alerts": [
                {
                    "id": a.id,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                    "alert_type": a.alert_type,
                    "risk_level": a.risk_level,
                    "model_name": a.model_name,
                    "confidence": a.confidence,
                    "anomaly_score": a.anomaly_score,
                    "source_ip": a.source_ip,
                    "dest_ip": a.dest_ip,
                    "protocol": a.protocol,
                    "description": a.description,
                    "acknowledged": a.acknowledged,
                    "is_demo": a.is_demo,
                }
                for a in alerts
            ],
        }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int):
    """Mark an alert as acknowledged."""
    async with AsyncSessionLocal() as db:
        alert = await db.get(Alert, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        alert.acknowledged = True
        await db.commit()
        return {"status": "ok", "alert_id": alert_id, "acknowledged": True}


@router.post("/alerts/seed")
async def seed_alerts():
    """Seed sample security incidents for testing."""
    sample_alerts = [
        Alert(
            alert_type="DDoS",
            risk_level="CRITICAL",
            model_name="random_forest",
            confidence=0.985,
            anomaly_score=0.95,
            source_ip="192.168.1.105",
            dest_ip="10.0.0.1",
            protocol="TCP",
            description="SYN Flood volumetric anomaly detected targeting HTTP port 80",
            acknowledged=False,
            is_demo=True,
        ),
        Alert(
            alert_type="PortScan",
            risk_level="HIGH",
            model_name="random_forest",
            confidence=0.912,
            anomaly_score=0.88,
            source_ip="192.168.1.189",
            dest_ip="10.0.0.1",
            protocol="TCP",
            description="Sequential port reconnaissance sweep across ports 20-1024",
            acknowledged=False,
            is_demo=True,
        ),
        Alert(
            alert_type="Brute Force",
            risk_level="HIGH",
            model_name="lstm",
            confidence=0.874,
            anomaly_score=0.82,
            source_ip="172.16.0.44",
            dest_ip="10.0.0.5",
            protocol="SSH",
            description="Repeated abnormal auth packet burst detected via SSH",
            acknowledged=False,
            is_demo=True,
        ),
        Alert(
            alert_type="Botnet",
            risk_level="CRITICAL",
            model_name="random_forest",
            confidence=0.963,
            anomaly_score=0.94,
            source_ip="192.168.1.202",
            dest_ip="198.51.100.23",
            protocol="UDP",
            description="Outbound periodic C2 beaconing anomaly detected",
            acknowledged=False,
            is_demo=True,
        ),
        Alert(
            alert_type="Web Attack",
            risk_level="MEDIUM",
            model_name="random_forest",
            confidence=0.784,
            anomaly_score=0.65,
            source_ip="10.0.0.88",
            dest_ip="10.0.0.1",
            protocol="HTTP",
            description="Suspicious payload length pattern indicative of SQLi / XSS",
            acknowledged=True,
            is_demo=True,
        ),
    ]
    async with AsyncSessionLocal() as db:
        for sa in sample_alerts:
            db.add(sa)
        await db.commit()
    return {"status": "ok", "seeded": len(sample_alerts)}


# ── Statistics ────────────────────────────────────────────────────────────────

@router.get("/statistics")
async def get_statistics():
    """
    Return aggregate statistics from the predictions database:
    total flows, benign/malicious counts, anomaly rate, attack distribution.
    """
    async with AsyncSessionLocal() as db:
        # Total predictions
        total_stmt = select(func.count(Prediction.id))
        total = (await db.execute(total_stmt)).scalar() or 0

        # Anomaly count
        anomaly_stmt = select(func.count(Prediction.id)).where(Prediction.is_anomaly == True)
        anomalies = (await db.execute(anomaly_stmt)).scalar() or 0

        # Attack type distribution
        dist_stmt = select(
            Prediction.predicted_class, func.count(Prediction.id)
        ).group_by(Prediction.predicted_class)
        dist_result = await db.execute(dist_stmt)
        attack_dist = {row[0]: row[1] for row in dist_result.fetchall() if row[0]}

        # Alert counts by risk level
        alert_stmt = select(
            Alert.risk_level, func.count(Alert.id)
        ).group_by(Alert.risk_level)
        alert_result = await db.execute(alert_stmt)
        alert_dist = {row[0]: row[1] for row in alert_result.fetchall() if row[0]}

        # Recent predictions (last 50)
        recent_stmt = (
            select(Prediction)
            .order_by(desc(Prediction.predicted_at))
            .limit(50)
        )
        recent_preds = (await db.execute(recent_stmt)).scalars().all()

        return {
            "total_flows": total,
            "benign_flows": total - anomalies,
            "malicious_flows": anomalies,
            "anomaly_rate": round(anomalies / max(total, 1), 4),
            "attack_distribution": attack_dist,
            "alert_distribution": alert_dist,
            "total_alerts": sum(alert_dist.values()),
            "recent_predictions": [
                {
                    "id": p.id,
                    "predicted_at": p.predicted_at.isoformat() if p.predicted_at else None,
                    "model_name": p.model_name,
                    "predicted_class": p.predicted_class,
                    "confidence": p.confidence,
                    "is_anomaly": p.is_anomaly,
                    "risk_level": p.risk_level,
                    "source_ip": p.source_ip,
                    "dest_ip": p.dest_ip,
                    "protocol": p.protocol,
                }
                for p in recent_preds
            ],
        }


# ── Model Comparison ──────────────────────────────────────────────────────────

@router.get("/model-comparison")
async def model_comparison():
    """
    Compare all trained models.
    Returns real metrics from actual model executions.
    """
    return compare_models()


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    """Health check endpoint."""
    from backend.services.inference_service import inference_service
    available = inference_service.available_models()
    return {
        "status": "ok",
        "version": "1.0.0",
        "models_available": available,
    }
