import base64
import math
import os
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class BloodPredictRequest(BaseModel):
    patient_id: str = Field(min_length=1)
    image_base64: str = Field(min_length=100)


class BloodPredictResponse(BaseModel):
    patient_id: str
    hemoglobin_g_dl: float
    risk_band: str
    confidence: float
    roi_quality: float
    method: str
    warnings: list[str]


app = FastAPI(title="Blood Service", version="0.1.0")


def _as_float(env_key: str, fallback: float) -> float:
    value = os.getenv(env_key)
    if value is None:
        return fallback
    try:
        return float(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid float for {env_key}: {value}") from exc


def _decode_image(image_base64: str) -> np.ndarray:
    raw = image_base64.strip()
    if "," in raw:
        raw = raw.split(",", 1)[1]
    pad = len(raw) % 4
    if pad:
        raw += "=" * (4 - pad)

    try:
        payload = base64.b64decode(raw, validate=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc

    arr = np.frombuffer(payload, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Image decode failed")
    return img


def _auto_canny(gray_image: np.ndarray, sigma: float = 0.55) -> np.ndarray:
    median_value = float(np.median(gray_image))
    lower = int(max(0.0, (1.0 - sigma) * median_value))
    upper = int(min(255.0, (1.0 + sigma) * median_value))
    return cv2.Canny(gray_image, lower, upper)


def _extract_eye_roi(image_bgr: np.ndarray) -> tuple[np.ndarray, list[str]]:
    warnings: list[str] = []
    cascade_path = cv2.data.haarcascades + "haarcascade_eye.xml"
    eye_detector = cv2.CascadeClassifier(cascade_path)
    if eye_detector.empty():
        raise HTTPException(status_code=500, detail="OpenCV eye cascade unavailable")

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    eyes = eye_detector.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=4, minSize=(80, 80))
    if len(eyes) == 0:
        raise HTTPException(status_code=422, detail="No eye detected in image")

    x, y, w, h = max(eyes, key=lambda item: item[2] * item[3])
    eye_roi = image_bgr[y:y + h, x:x + w].copy()

    eyebrow_trim = int(eye_roi.shape[0] * 0.25)
    eye_roi = eye_roi[eyebrow_trim:, :]
    if eye_roi.size == 0:
        raise HTTPException(status_code=422, detail="Eye ROI is empty after eyebrow trim")

    gray_eye = cv2.cvtColor(eye_roi, cv2.COLOR_BGR2GRAY)
    _, binary_inv = cv2.threshold(gray_eye, 35, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    binary_inv = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, kernel, iterations=1)
    binary_inv = cv2.dilate(binary_inv, kernel, iterations=2)

    contours, _ = cv2.findContours(binary_inv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if len(contours) == 0:
        raise HTTPException(status_code=422, detail="Pupil centroid not detected")

    largest = max(contours, key=cv2.contourArea)
    moments = cv2.moments(largest)
    if moments["m00"] == 0:
        raise HTTPException(status_code=422, detail="Pupil centroid moments invalid")

    centroid_y = int(moments["m01"] / moments["m00"])
    centroid_offset = int(_as_float("BLOOD_CENTROID_OFFSET_PX", 25.0))
    crop_from_y = min(max(0, centroid_y + centroid_offset), eye_roi.shape[0] - 1)

    side_margin = max(1, eye_roi.shape[1] // 6)
    reduced = eye_roi[crop_from_y:, side_margin:eye_roi.shape[1] - side_margin]
    if reduced.size == 0:
        raise HTTPException(status_code=422, detail="Reduced conjunctiva ROI is empty")

    if reduced.shape[0] < 24 or reduced.shape[1] < 24:
        warnings.append("Conjunctiva ROI is small; confidence reduced.")

    return reduced, warnings


def _extract_conjunctiva_region(reduced_roi: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(reduced_roi, cv2.COLOR_BGR2GRAY)
    edges = _auto_canny(gray)

    mask = np.zeros_like(edges)
    for col in range(edges.shape[1]):
        white_rows = np.where(edges[:, col] > 0)[0]
        if white_rows.size > 0:
            first_white = int(white_rows[0])
            mask[:first_white + 1, col] = 255

    inverted = cv2.bitwise_not(mask)
    subtractor = cv2.cvtColor(inverted, cv2.COLOR_GRAY2BGR)
    conjunctiva = cv2.subtract(reduced_roi, subtractor)

    blackish = np.all(conjunctiva < 10, axis=2)
    conjunctiva[blackish] = (255, 255, 255)
    return conjunctiva


def _estimate_hb_from_roi(conjunctiva_bgr: np.ndarray) -> tuple[float, float, list[str]]:
    warnings: list[str] = []
    valid_mask = np.all(conjunctiva_bgr < 220, axis=2)
    valid_ratio = float(np.count_nonzero(valid_mask)) / float(valid_mask.size)

    if valid_ratio < 0.01:
        raise HTTPException(status_code=422, detail="Conjunctiva pixels not found. Capture a clearer inner-eyelid image.")
    if valid_ratio < 0.05:
        warnings.append("Very low conjunctiva coverage detected; hemoglobin estimate may be unstable.")

    rgb = cv2.cvtColor(conjunctiva_bgr, cv2.COLOR_BGR2RGB)
    coords = np.argwhere(valid_mask)
    min_row, min_col = coords.min(axis=0)
    max_row, max_col = coords.max(axis=0)
    mid_col = int((min_col + max_col) / 2)

    span = max_row - min_row + 1
    y_anchor = min_row + int(0.2 * span)
    y_anchor = max(min_row, min(y_anchor, max_row - 5))

    patch_half = 2
    patch_offsets = (-10, 0, 10)
    means: list[np.ndarray] = []

    for x_offset in patch_offsets:
        cx = max(min_col + patch_half, min(mid_col + x_offset, max_col - patch_half))
        patch = rgb[y_anchor:y_anchor + 5, cx - patch_half:cx + patch_half + 1]
        patch_mask = valid_mask[y_anchor:y_anchor + 5, cx - patch_half:cx + patch_half + 1]
        valid_pixels = patch[patch_mask]
        if valid_pixels.size == 0:
            continue
        means.append(valid_pixels.mean(axis=0))

    if len(means) == 0:
        raise HTTPException(status_code=422, detail="Conjunctiva patch extraction failed")

    mean_rgb = np.mean(np.stack(means, axis=0), axis=0)
    red, green, blue = (float(mean_rgb[0]), float(mean_rgb[1]), float(mean_rgb[2]))

    intercept = _as_float("BLOOD_LOGIT_B0", -1.922)
    coef_r = _as_float("BLOOD_LOGIT_R", 0.206)
    coef_g = _as_float("BLOOD_LOGIT_G", -0.241)
    coef_b = _as_float("BLOOD_LOGIT_B", 0.012)
    hb_scale = _as_float("BLOOD_HB_SCALE", 10.0)
    hb_offset = _as_float("BLOOD_HB_OFFSET", 3.0)
    hb_min = _as_float("BLOOD_HB_MIN", 10.0)

    logistic_score = intercept + (coef_r * red) + (coef_g * green) + (coef_b * blue)
    probability = 1.0 / (1.0 + math.exp(-logistic_score))
    hb_value = max(hb_min, (probability * hb_scale) + hb_offset)

    confidence = max(0.0, min(1.0, 0.45 + (valid_ratio * 0.8)))
    return float(hb_value), float(confidence), warnings


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "blood-service"}


@app.post("/predict", response_model=BloodPredictResponse)
def predict(payload: BloodPredictRequest) -> BloodPredictResponse:
    image_bgr = _decode_image(payload.image_base64)
    reduced_roi, warnings = _extract_eye_roi(image_bgr)
    conjunctiva = _extract_conjunctiva_region(reduced_roi)
    hb_value, confidence, hb_warnings = _estimate_hb_from_roi(conjunctiva)

    medium_threshold = _as_float("BLOOD_MEDIUM_HB_THRESHOLD", 11.5)
    high_threshold = _as_float("BLOOD_HIGH_HB_THRESHOLD", 10.0)

    if hb_value < high_threshold:
        risk_band = "high"
    elif hb_value < medium_threshold:
        risk_band = "medium"
    else:
        risk_band = "low"

    roi_quality = max(0.0, min(1.0, confidence))

    return BloodPredictResponse(
        patient_id=payload.patient_id,
        hemoglobin_g_dl=round(hb_value, 3),
        risk_band=risk_band,
        confidence=round(confidence, 4),
        roi_quality=round(roi_quality, 4),
        method="sHEMO-style conjunctiva spectroscopy",
        warnings=warnings + hb_warnings,
    )
