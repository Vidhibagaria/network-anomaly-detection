"""
Demo/synthetic data generator for testing the pipeline without CIC-IDS 2017.

IMPORTANT:
    Results from synthetic data are CLEARLY LABELED as demo/synthetic.
    They must NEVER be presented as CIC-IDS 2017 results.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from backend.config import settings

logger = logging.getLogger(__name__)

# CIC-IDS 2017 representative features (subset for demo)
DEMO_FEATURES = [
    "Destination Port", "Flow Duration", "Total Fwd Packets", "Total Backward Packets",
    "Total Length of Fwd Packets", "Total Length of Bwd Packets",
    "Fwd Packet Length Max", "Fwd Packet Length Min", "Fwd Packet Length Mean",
    "Fwd Packet Length Std", "Bwd Packet Length Max", "Bwd Packet Length Min",
    "Bwd Packet Length Mean", "Bwd Packet Length Std", "Flow Bytes/s",
    "Flow Packets/s", "Flow IAT Mean", "Flow IAT Std", "Flow IAT Max", "Flow IAT Min",
    "Fwd IAT Total", "Fwd IAT Mean", "Fwd IAT Std", "Fwd IAT Max", "Fwd IAT Min",
    "Bwd IAT Total", "Bwd IAT Mean", "Bwd IAT Std", "Bwd IAT Max", "Bwd IAT Min",
    "Fwd PSH Flags", "Bwd PSH Flags", "Fwd URG Flags", "Bwd URG Flags",
    "Fwd Header Length", "Bwd Header Length", "Fwd Packets/s", "Bwd Packets/s",
    "Min Packet Length", "Max Packet Length", "Packet Length Mean", "Packet Length Std",
    "Packet Length Variance", "FIN Flag Count", "SYN Flag Count", "RST Flag Count",
    "PSH Flag Count", "ACK Flag Count", "URG Flag Count", "CWE Flag Count",
    "ECE Flag Count", "Down/Up Ratio", "Average Packet Size", "Avg Fwd Segment Size",
    "Avg Bwd Segment Size", "Fwd Header Length.1", "Fwd Avg Bytes/Bulk",
    "Fwd Avg Packets/Bulk", "Fwd Avg Bulk Rate", "Bwd Avg Bytes/Bulk",
    "Bwd Avg Packets/Bulk", "Bwd Avg Bulk Rate", "Subflow Fwd Packets",
    "Subflow Fwd Bytes", "Subflow Bwd Packets", "Subflow Bwd Bytes",
    "Init_Win_bytes_forward", "Init_Win_bytes_backward", "act_data_pkt_fwd",
    "min_seg_size_forward", "Active Mean", "Active Std", "Active Max", "Active Min",
    "Idle Mean", "Idle Std", "Idle Max", "Idle Min",
]

# Attack labels and their proportion in demo data
DEMO_LABEL_DIST = {
    "BENIGN": 0.80,
    "DoS": 0.06,
    "DDoS": 0.05,
    "PortScan": 0.04,
    "Brute Force": 0.02,
    "Web Attack": 0.01,
    "Botnet": 0.01,
    "Infiltration": 0.005,
    "Heartbleed": 0.005,
}

# Per-attack statistical profiles (mean, std multiplier per feature)
_ATTACK_PROFILES = {
    "BENIGN":      {"scale": 1.0,  "duration_mult": 1.0,  "pkt_mult": 1.0},
    "DoS":         {"scale": 5.0,  "duration_mult": 0.1,  "pkt_mult": 10.0},
    "DDoS":        {"scale": 8.0,  "duration_mult": 0.05, "pkt_mult": 20.0},
    "PortScan":    {"scale": 0.5,  "duration_mult": 0.01, "pkt_mult": 1.0},
    "Brute Force": {"scale": 1.5,  "duration_mult": 2.0,  "pkt_mult": 3.0},
    "Web Attack":  {"scale": 1.2,  "duration_mult": 1.5,  "pkt_mult": 1.5},
    "Botnet":      {"scale": 0.8,  "duration_mult": 5.0,  "pkt_mult": 0.5},
    "Infiltration":{"scale": 1.0,  "duration_mult": 10.0, "pkt_mult": 1.0},
    "Heartbleed":  {"scale": 2.0,  "duration_mult": 0.5,  "pkt_mult": 2.0},
}


def generate_demo_dataset(
    n_samples: int = 5000,
    random_seed: int = 42,
    output_path: Optional[Path] = None,
) -> pd.DataFrame:
    """
    Generate a synthetic demo dataset that mimics CIC-IDS 2017 structure.

    WARNING: This is SYNTHETIC data for pipeline testing ONLY.
             It does NOT represent real network traffic.
    """
    rng = np.random.RandomState(random_seed)
    logger.warning(
        "Generating SYNTHETIC demo data. "
        "This data must NOT be presented as CIC-IDS 2017 results."
    )

    rows = []
    labels = []

    for label, proportion in DEMO_LABEL_DIST.items():
        n = max(10, int(n_samples * proportion))
        profile = _ATTACK_PROFILES[label]
        scale = profile["scale"]
        dur_m = profile["duration_mult"]
        pkt_m = profile["pkt_mult"]

        for _ in range(n):
            row = {}
            for j, feat in enumerate(DEMO_FEATURES):
                base = rng.exponential(scale=scale * (j % 5 + 1) * 100)
                if "Duration" in feat:
                    base *= dur_m
                if "Packet" in feat or "Bytes" in feat:
                    base *= pkt_m
                row[feat] = max(0.0, base)

            # Specific feature overrides for realism
            row["Destination Port"] = rng.choice([80, 443, 22, 21, 23, 3389, 8080])
            if label == "PortScan":
                row["Destination Port"] = rng.randint(1, 65535)
            row["SYN Flag Count"] = rng.poisson(2 if label == "DDoS" else 0.5)
            row["FIN Flag Count"] = rng.poisson(0.5)
            row["ACK Flag Count"] = rng.poisson(3)

            rows.append(row)
            labels.append(label)

    df = pd.DataFrame(rows)
    df["Label"] = labels
    df = df.sample(frac=1, random_state=random_seed).reset_index(drop=True)

    # Add a clear demo marker column
    df["_is_demo"] = True

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        df.drop(columns=["_is_demo"]).to_csv(output_path, index=False)
        logger.info(f"Demo dataset saved to {output_path} ({len(df)} rows)")

    return df


def get_or_create_demo_csv(n_samples: int = 5000) -> Path:
    """Return path to a demo CSV, creating it if necessary."""
    demo_path = settings.DATA_DIR / "demo_dataset.csv"
    if not demo_path.exists():
        df = generate_demo_dataset(n_samples=n_samples)
        df.drop(columns=["_is_demo"], errors="ignore").to_csv(demo_path, index=False)
        logger.info(f"Created demo dataset at {demo_path}")
    return demo_path
