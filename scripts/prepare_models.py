from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor


ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"


def _ensure_dirs() -> None:
    (MODELS / "depression").mkdir(parents=True, exist_ok=True)
    (MODELS / "ppg").mkdir(parents=True, exist_ok=True)
    (MODELS / "kineticare").mkdir(parents=True, exist_ok=True)


def build_depression_model() -> None:
    rng = np.random.default_rng(42)
    n = 2000

    text_signal = rng.uniform(0.0, 1.0, n)
    audio_signal = rng.uniform(0.0, 1.0, n)
    video_signal = rng.uniform(0.0, 1.0, n)
    camera_sqi = rng.uniform(0.7, 1.0, n)
    spoof_flag = rng.integers(0, 2, n)

    X = np.column_stack([text_signal, audio_signal, video_signal, camera_sqi, spoof_flag])
    y = (0.55 * text_signal) + (0.2 * audio_signal) + (0.2 * video_signal) + (0.05 * (1.0 - spoof_flag))
    y = np.clip(y + rng.normal(0, 0.03, n), 0.0, 1.0)

    model = RandomForestRegressor(n_estimators=240, random_state=42)
    model.fit(X, y)
    joblib.dump(model, MODELS / "depression" / "depression_score_model.joblib")


def build_ppg_model() -> None:
    rng = np.random.default_rng(84)
    n = 2400

    mean_signal = rng.normal(0.0, 0.18, n)
    std_signal = rng.uniform(0.02, 0.5, n)
    max_signal = mean_signal + rng.uniform(0.1, 1.0, n)
    min_signal = mean_signal - rng.uniform(0.1, 1.0, n)
    baseline_map = rng.uniform(70.0, 110.0, n)
    sig_len = rng.integers(50, 1000, n)

    X = np.column_stack([mean_signal, std_signal, max_signal, min_signal, baseline_map, sig_len])
    y = (2.4 * mean_signal) + (0.65 * std_signal) + (0.02 * (sig_len / 100.0)) + rng.normal(0, 0.2, n)

    model = RandomForestRegressor(n_estimators=260, random_state=84)
    model.fit(X, y)
    joblib.dump(model, MODELS / "ppg" / "ppg_delta_model.joblib")


def build_kineticare_model() -> None:
    rng = np.random.default_rng(126)
    n = 2200

    dwell_mean = rng.uniform(60, 240, n)
    dwell_std = rng.uniform(5, 90, n)
    flight_mean = rng.uniform(30, 220, n)
    entropy = rng.uniform(0.6, 4.0, n)
    tremor_ratio = rng.uniform(0.0, 0.45, n)

    X = np.column_stack([dwell_mean, dwell_std, flight_mean, entropy, tremor_ratio])

    y = np.zeros(n, dtype=int)
    medium_mask = (dwell_std > 30) | (entropy > 2.2) | (tremor_ratio > 0.12)
    high_mask = (dwell_std > 55) & (entropy > 2.8) | (tremor_ratio > 0.22)
    y[medium_mask] = 1
    y[high_mask] = 2

    model = RandomForestClassifier(n_estimators=300, random_state=126)
    model.fit(X, y)
    joblib.dump(model, MODELS / "kineticare" / "kineticare_risk_model.joblib")


def main() -> None:
    _ensure_dirs()
    build_depression_model()
    build_ppg_model()
    build_kineticare_model()
    print("Prepared local model artifacts in ./models")


if __name__ == "__main__":
    main()
