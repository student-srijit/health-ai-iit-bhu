import math
import os
from collections import Counter
from pathlib import Path
from statistics import mean, pstdev

from fastapi import FastAPI
import joblib
import numpy as np
from pydantic import BaseModel, Field


class KinetiCareRiskRequest(BaseModel):
    patient_id: str = Field(min_length=1)
    dwell_times_ms: list[float] = Field(min_length=8)
    flight_times_ms: list[float] = Field(min_length=8)
    imu_accel_magnitude: list[float] = Field(min_length=64)
    sampling_rate_hz: float = Field(default=50.0, gt=0)


class KinetiCareRiskResponse(BaseModel):
    patient_id: str
    risk_band: str
    session_quality: str
    signals_used: list[str]
    feature_summary: dict[str, float]


def _safe_entropy(values: list[float]) -> float:
    if not values:
        return 0.0
    bins = [int(v // 20) for v in values]
    counts = Counter(bins)
    total = len(bins)
    entropy = 0.0
    for _, count in counts.items():
        p = count / total
        entropy -= p * math.log2(p)
    return entropy


def _dft_band_energy(signal: list[float], sample_rate: float, low_hz: float, high_hz: float) -> float:
    n = len(signal)
    if n == 0:
        return 0.0

    centered = [x - mean(signal) for x in signal]
    total_energy = 0.0
    band_energy = 0.0

    for k in range(1, n // 2):
        freq = (k * sample_rate) / n
        re = 0.0
        im = 0.0
        for i, x in enumerate(centered):
            angle = (2.0 * math.pi * k * i) / n
            re += x * math.cos(angle)
            im -= x * math.sin(angle)
        mag2 = re * re + im * im
        total_energy += mag2
        if low_hz <= freq <= high_hz:
            band_energy += mag2

    if total_energy <= 0:
        return 0.0
    return band_energy / total_energy


app = FastAPI(title="KinetiCare Service", version="0.1.0")


def _artifact_path() -> Path:
    model_dir = os.getenv("MODEL_DIR")
    if model_dir:
        return Path(model_dir) / "kineticare" / "kineticare_risk_model.joblib"
    return Path(__file__).resolve().parents[4] / "models" / "kineticare" / "kineticare_risk_model.joblib"


def _load_model():
    path = _artifact_path()
    if path.exists():
        return joblib.load(path)
    return None


KINETICARE_MODEL = _load_model()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "kineticare-service"}


@app.post("/predict", response_model=KinetiCareRiskResponse)
def predict(payload: KinetiCareRiskRequest) -> KinetiCareRiskResponse:
    dwell_mean = mean(payload.dwell_times_ms)
    dwell_std = pstdev(payload.dwell_times_ms) if len(payload.dwell_times_ms) > 1 else 0.0
    flight_mean = mean(payload.flight_times_ms)
    hesitation_entropy = _safe_entropy(payload.flight_times_ms)
    tremor_ratio_4_6hz = _dft_band_energy(payload.imu_accel_magnitude, payload.sampling_rate_hz, 4.0, 6.0)

    if KINETICARE_MODEL is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Model artifact missing. Run prepare_models.py")

    features = np.array([[dwell_mean, dwell_std, flight_mean, hesitation_entropy, tremor_ratio_4_6hz]], dtype=float)
    pred = int(KINETICARE_MODEL.predict(features)[0])
    label_map = {0: "low", 1: "medium", 2: "high"}
    risk_band = label_map.get(pred, "medium")

    sample_ok = len(payload.imu_accel_magnitude) >= 128 and len(payload.dwell_times_ms) >= 16
    session_quality = "good" if sample_ok else "warning"

    return KinetiCareRiskResponse(
        patient_id=payload.patient_id,
        risk_band=risk_band,
        session_quality=session_quality,
        signals_used=["keystroke", "imu"],
        feature_summary={
            "dwell_mean_ms": round(dwell_mean, 3),
            "dwell_std_ms": round(dwell_std, 3),
            "flight_mean_ms": round(flight_mean, 3),
            "hesitation_entropy": round(hesitation_entropy, 4),
            "tremor_ratio_4_6hz": round(tremor_ratio_4_6hz, 4),
        },
    )
