import math
import os
from statistics import mean, pstdev

from fastapi import FastAPI
from pydantic import BaseModel, Field


class NervousPredictRequest(BaseModel):
    patient_id: str = Field(min_length=1)
    tap_intervals_ms: list[float] = Field(min_length=10)
    tap_distances_px: list[float] = Field(min_length=10)
    tremor_signal: list[float] = Field(min_length=64)
    sampling_rate_hz: float = Field(gt=0)


class NervousPredictResponse(BaseModel):
    patient_id: str
    risk_band: str
    session_quality: str
    confidence: float
    tap_rate_hz: float
    tremor_hz: float
    amplitude_dropoff: float
    metrics: dict[str, float]


app = FastAPI(title="Nervous Service", version="0.1.0")


def _as_float(env_key: str, fallback: float) -> float:
    value = os.getenv(env_key)
    if value is None:
        return fallback
    try:
        return float(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid float for {env_key}: {value}") from exc


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(value, high))


def _dft_peak_hz(signal: list[float], sample_rate_hz: float, low_hz: float, high_hz: float) -> tuple[float, float]:
    n = len(signal)
    if n < 8:
        return 0.0, 0.0

    centered = [s - mean(signal) for s in signal]
    total_energy = 0.0
    best_freq = 0.0
    best_energy = 0.0
    band_energy = 0.0

    for k in range(1, n // 2):
        freq = (k * sample_rate_hz) / n
        re = 0.0
        im = 0.0
        for i, value in enumerate(centered):
            angle = (2.0 * math.pi * k * i) / n
            re += value * math.cos(angle)
            im -= value * math.sin(angle)
        mag2 = re * re + im * im
        total_energy += mag2
        if low_hz <= freq <= high_hz:
            band_energy += mag2
            if mag2 > best_energy:
                best_energy = mag2
                best_freq = freq

    ratio = (band_energy / total_energy) if total_energy > 0 else 0.0
    return best_freq, ratio


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "nervous-service"}


@app.post("/predict", response_model=NervousPredictResponse)
def predict(payload: NervousPredictRequest) -> NervousPredictResponse:
    tap_rate_hz = 1000.0 / max(mean(payload.tap_intervals_ms), 1.0)

    first_window = payload.tap_distances_px[: max(3, len(payload.tap_distances_px) // 3)]
    last_window = payload.tap_distances_px[-max(3, len(payload.tap_distances_px) // 3):]
    first_amp = max(mean(first_window), 1e-6)
    last_amp = mean(last_window)
    amplitude_dropoff = _clamp(1.0 - (last_amp / first_amp), 0.0, 1.0)

    tremor_hz, tremor_ratio = _dft_peak_hz(payload.tremor_signal, payload.sampling_rate_hz, 3.0, 8.0)

    tap_interval_cv = 0.0
    if len(payload.tap_intervals_ms) > 1:
        tap_interval_cv = pstdev(payload.tap_intervals_ms) / max(mean(payload.tap_intervals_ms), 1.0)

    target_tap_rate_hz = _as_float("NERVOUS_TARGET_TAP_RATE_HZ", 4.0)
    w_dropoff = _as_float("NERVOUS_WEIGHT_DROPOFF", 0.35)
    w_tremor = _as_float("NERVOUS_WEIGHT_TREMOR", 0.35)
    w_irregularity = _as_float("NERVOUS_WEIGHT_IRREGULARITY", 0.20)
    w_slowing = _as_float("NERVOUS_WEIGHT_SLOWING", 0.10)

    dropoff_norm = _clamp(amplitude_dropoff / 0.5, 0.0, 1.0)
    tremor_norm = _clamp(tremor_ratio / 0.25, 0.0, 1.0)
    irregularity_norm = _clamp(tap_interval_cv / 0.5, 0.0, 1.0)
    slowing_norm = _clamp(max(0.0, target_tap_rate_hz - tap_rate_hz) / max(target_tap_rate_hz, 1.0), 0.0, 1.0)

    risk_score = (
        (w_dropoff * dropoff_norm)
        + (w_tremor * tremor_norm)
        + (w_irregularity * irregularity_norm)
        + (w_slowing * slowing_norm)
    )

    high_threshold = _as_float("NERVOUS_HIGH_RISK_THRESHOLD", 0.66)
    medium_threshold = _as_float("NERVOUS_MEDIUM_RISK_THRESHOLD", 0.40)

    if risk_score >= high_threshold:
        risk_band = "high"
    elif risk_score >= medium_threshold:
        risk_band = "medium"
    else:
        risk_band = "low"

    if len(payload.tap_intervals_ms) >= 20 and len(payload.tremor_signal) >= 128:
        session_quality = "good"
    elif len(payload.tap_intervals_ms) >= 12 and len(payload.tremor_signal) >= 80:
        session_quality = "warning"
    else:
        session_quality = "poor"

    confidence = _clamp(0.35 + (0.5 * _clamp(len(payload.tremor_signal) / 128.0, 0.0, 1.0)) + (0.15 * _clamp(len(payload.tap_intervals_ms) / 20.0, 0.0, 1.0)), 0.0, 1.0)

    return NervousPredictResponse(
        patient_id=payload.patient_id,
        risk_band=risk_band,
        session_quality=session_quality,
        confidence=round(confidence, 4),
        tap_rate_hz=round(tap_rate_hz, 4),
        tremor_hz=round(tremor_hz, 4),
        amplitude_dropoff=round(amplitude_dropoff, 4),
        metrics={
            "risk_score": round(risk_score, 4),
            "tremor_ratio_3_8hz": round(tremor_ratio, 4),
            "tap_interval_cv": round(tap_interval_cv, 4),
        },
    )
