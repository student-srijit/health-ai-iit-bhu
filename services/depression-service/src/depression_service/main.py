import base64
import io
import math
import os
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from fastapi import FastAPI
from pydantic import BaseModel, Field

try:
    from PIL import Image
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False


# ─── Pydantic models ──────────────────────────────────────────────────────────

class CameraMetrics(BaseModel):
    frame_quality_score: float = Field(ge=0.0, le=1.0)
    blur_score: float = Field(ge=0.0, le=1.0)
    face_tracking_confidence: float = Field(ge=0.0, le=1.0)
    spoof_probability: float = Field(ge=0.0, le=1.0)
    accepted_window_ratio: float = Field(ge=0.0, le=1.0)
    laplacian_variance: float = Field(ge=0.0)
    frequency_spoof_score: float = Field(ge=0.0, le=1.0)


class DepressionPredictRequest(BaseModel):
    patient_id: str = Field(min_length=1)
    journal_text: str = Field(min_length=1)
    audio_features: list[float] = Field(default_factory=list)
    video_features: list[float] = Field(default_factory=list)
    camera_metrics: CameraMetrics | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DepressionPredictResponse(BaseModel):
    patient_id: str
    status: str
    depression_score: float
    risk_band: str
    confidence: float
    modalities_used: list[str]
    camera_sqi: float | None = None
    spoof_detected: bool = False
    error_message: str | None = None


class MediaAnalyzeRequest(BaseModel):
    """Accept raw PCM audio (base64) + list of JPEG frames (base64) for feature extraction."""
    audio_base64: str = Field(default="", description="Base64-encoded raw PCM float32 LE audio bytes")
    video_frames: list[str] = Field(default_factory=list, description="Base64-encoded JPEG frames")
    sample_rate: int = Field(default=16000, gt=0)


class MediaAnalyzeResponse(BaseModel):
    audio_features: list[float]
    video_features: list[float]
    frames_processed: int
    extraction_method: str


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Depression Service", version="0.2.0")


# ─── Model loading ────────────────────────────────────────────────────────────

def _artifact_path() -> Path:
    model_dir = os.getenv("MODEL_DIR")
    if model_dir:
        return Path(model_dir) / "depression" / "depression_score_model.joblib"
    return Path(__file__).resolve().parents[4] / "models" / "depression" / "depression_score_model.joblib"


def _load_model() -> Any | None:
    path = _artifact_path()
    if path.exists():
        return joblib.load(path)
    return None


DEP_MODEL = _load_model()


# ─── Signal utilities ─────────────────────────────────────────────────────────

def _kalman_interpolate(signal: list[float]) -> list[float]:
    if not signal:
        return []
    q, r, x, p = 1e-5, 1e-2, signal[0], 1.0
    out: list[float] = []
    for z in signal:
        p = p + q
        k = p / (p + r)
        x = x + k * (z - x)
        p = (1 - k) * p
        out.append(x)
    return out


def _compute_camera_sqi(metrics: CameraMetrics) -> float:
    sqi = (
        0.35 * metrics.frame_quality_score
        + 0.20 * metrics.face_tracking_confidence
        + 0.20 * metrics.accepted_window_ratio
        + 0.15 * (1.0 - metrics.blur_score)
        + 0.10 * (1.0 - metrics.spoof_probability)
    )
    return max(0.0, min(sqi, 1.0))


def _detect_spoof(metrics: CameraMetrics) -> bool:
    return (
        metrics.laplacian_variance < 20.0
        or metrics.frequency_spoof_score > 0.65
        or metrics.spoof_probability > 0.6
    )


# ─── Audio feature extraction (MFCC-proxy via numpy DFT) ────────────────────

def _extract_audio_features(pcm_bytes: bytes, sample_rate: int, n_features: int = 128) -> list[float]:
    """
    Compute 128-dim audio feature vector from raw float32 PCM bytes.
    Technique: overlapping frames → log-spectrum band energies (MFCC-proxy).
    Pure numpy, no librosa required.
    """
    if len(pcm_bytes) < 4:
        return [0.0] * n_features
    try:
        signal = np.frombuffer(pcm_bytes, dtype=np.float32).astype(np.float64)
    except Exception:
        return [0.0] * n_features

    if len(signal) < 64:
        return [0.0] * n_features

    signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

    frame_len = min(512, len(signal))
    hop = frame_len // 2
    n_frames = max(1, (len(signal) - frame_len) // hop + 1)
    window = np.hanning(frame_len)

    band_energies: list[float] = []
    for i in range(n_frames):
        start = i * hop
        frame = signal[start: start + frame_len]
        if len(frame) < frame_len:
            frame = np.pad(frame, (0, frame_len - len(frame)))
        frame = frame * window
        spectrum = np.abs(np.fft.rfft(frame)) ** 2
        # Split spectrum into n_features bands
        n_bins = len(spectrum)
        band_size = max(1, n_bins // n_features)
        for b in range(n_features):
            seg = spectrum[b * band_size: (b + 1) * band_size]
            energy = float(np.mean(seg)) if len(seg) > 0 else 0.0
            band_energies.append(math.log1p(energy))

    # Average across frames per band
    arr = np.array(band_energies).reshape(-1, n_features)
    avg = arr.mean(axis=0)
    # Normalise to [0, 1]
    mx = avg.max()
    if mx > 0:
        avg = avg / mx
    return avg.tolist()


# ─── Video feature extraction (forehead ROI pixel variance across frames) ────

def _extract_video_features(frames_b64: list[str], n_features: int = 128) -> list[float]:
    """
    Compute 128-dim video feature vector from JPEG frames.
    Uses forehead ROI pixel intensity variance across consecutive frames
    as a proxy for micro-expression and facial motion signals.
    """
    if not frames_b64 or not _PIL_AVAILABLE:
        return [0.0] * n_features

    gray_sequences: list[np.ndarray] = []
    for frame_b64 in frames_b64[:64]:  # cap at 64 frames for speed
        try:
            img_bytes = base64.b64decode(frame_b64)
            img = Image.open(io.BytesIO(img_bytes)).convert("L")  # grayscale
            # Crop top third (rough forehead/upper face ROI)
            w, h = img.size
            roi = img.crop((w // 4, 0, 3 * w // 4, h // 3))
            resized = roi.resize((16, 8))  # 128 pixels exactly
            arr = np.array(resized, dtype=np.float64).flatten() / 255.0
            gray_sequences.append(arr)
        except Exception:
            continue

    if len(gray_sequences) < 2:
        return [0.0] * n_features

    seqs = np.stack(gray_sequences)  # (n_frames, 128)
    # Frame-to-frame delta magnitudes
    deltas = np.abs(np.diff(seqs, axis=0))  # (n_frames-1, 128)
    # Mean absolute delta per pixel position
    features = deltas.mean(axis=0)
    # Normalise
    mx = features.max()
    if mx > 0:
        features = features / mx
    return features.tolist()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "depression-service"}


@app.post("/analyze-media", response_model=MediaAnalyzeResponse)
def analyze_media(payload: MediaAnalyzeRequest) -> MediaAnalyzeResponse:
    """
    Extract audio and video features from raw media data.
    Frontend sends base64 PCM audio + base64 JPEG frames.
    Returns feature vectors ready to pass to /predict.
    """
    audio_pcm = base64.b64decode(payload.audio_base64) if payload.audio_base64 else b""
    audio_features = _extract_audio_features(audio_pcm, payload.sample_rate, n_features=128)
    video_features = _extract_video_features(payload.video_frames, n_features=128)

    method = "numpy_dft+roi_delta"
    if not _PIL_AVAILABLE:
        method = "numpy_dft_only (pillow not installed)"

    return MediaAnalyzeResponse(
        audio_features=audio_features,
        video_features=video_features,
        frames_processed=len(payload.video_frames),
        extraction_method=method,
    )


@app.post("/predict", response_model=DepressionPredictResponse)
def predict(payload: DepressionPredictRequest) -> DepressionPredictResponse:
    text_signal = min(len(payload.journal_text) / 500.0, 1.0)
    audio_signal = min(sum(abs(x) for x in payload.audio_features[:128]) / 128.0, 1.0) if payload.audio_features else 0.0
    smoothed_video = _kalman_interpolate(payload.video_features[:128])
    video_signal = min(sum(abs(x) for x in smoothed_video) / 128.0, 1.0) if smoothed_video else 0.0

    camera_sqi: float | None = None
    spoof_detected = False
    if payload.camera_metrics is not None:
        camera_sqi = _compute_camera_sqi(payload.camera_metrics)
        spoof_detected = _detect_spoof(payload.camera_metrics)
        if spoof_detected or camera_sqi < 0.8:
            return DepressionPredictResponse(
                patient_id=payload.patient_id,
                status="blocked",
                depression_score=0.0,
                risk_band="low",
                confidence=0.0,
                modalities_used=["text", "audio", "video"],
                camera_sqi=round(camera_sqi, 4),
                spoof_detected=spoof_detected,
                error_message="Biometric interference detected. Please disable camera filters and ensure natural lighting.",
            )

    if DEP_MODEL is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Model artifact missing. Run prepare_models.py")

    camera_input = camera_sqi if camera_sqi is not None else 1.0
    features = np.array([[text_signal, audio_signal, video_signal, camera_input, float(spoof_detected)]], dtype=float)
    score = float(DEP_MODEL.predict(features)[0])
    score = max(0.0, min(score, 1.0))
    confidence = 0.82

    risk = "high" if score >= 0.7 else ("medium" if score >= 0.4 else "low")

    modalities = ["text"]
    if payload.audio_features:
        modalities.append("audio")
    if payload.video_features:
        modalities.append("video")

    confidence = min(confidence + (0.1 * (len(modalities) - 1)), 0.95)

    return DepressionPredictResponse(
        patient_id=payload.patient_id,
        status="accepted",
        depression_score=round(score, 4),
        risk_band=risk,
        confidence=round(confidence, 4),
        modalities_used=modalities,
        camera_sqi=round(camera_sqi, 4) if camera_sqi is not None else None,
        spoof_detected=spoof_detected,
    )
