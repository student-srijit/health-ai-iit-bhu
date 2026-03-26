# 🧬 KinetiCare Health AI (IIT-BHU)
**Award-Winning Multimodal Clinical Decision Support & Zero-UI Diagnostics**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.103-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://www.python.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blueviolet?logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

Welcome to **KinetiCare**, a revolutionary 3-pillar multimodal health AI platform built for seamless, zero-error clinical automation. By combining advanced facial phenotyping, remote non-invasive hemodynamics, and invisible neuromotor telemetry, KinetiCare offers medical-grade health insights—entirely within your smartphone browser.

---

## 🚀 The 3-Pillar Multimodal Architecture

### 1. 🧠 Depression Phenotyping (Linguistic & Visual)
Leverages cutting-edge facial encoding and linguistic sentiment logs to compute a unified depression risk score.
- **Visual Capture**: Extracts frame-by-frame micro-expressions using the user's camera to construct a stable clinical phenotype embedding.
- **Multimodal Fusing**: Fuses text-based journal logs with visual data for high-confidence risk banding.

### 2. 🫀 Non-Invasive PPG Capture (Hemodynamic Vitals)
Transforms any standard smartphone camera into a clinical-grade pulse oximeter utilizing Photoplethysmography (PPG).
- **Green-Channel Extraction**: Dynamically isolates the green wavelength from video frames to track microvascular blood volume changes.
- **Topological Peak Detection**: Analyzes the continuous waveform utilizing advanced `scipy.signal` FFT algorithms to identify absolute systolic peaks.
- **Vitals Output**: Accurately derives **Heart Rate (BPM)**, **Systolic (SBP)**, **Diastolic (DBP)**, and predicts changes in the **Mean Arterial Pressure (MAP)**.
- **Hardware Edge Case Handling**: Automatically queries the browser for the `torch` API to physically activate the smartphone flash for medical-grade illumination, while rendering a graceful UI warning for laptop webcams.

### 3. ⚡ KinetiCare: Zero-UI Neurological Tracking
Instead of explicit cognitive quizzes, KinetiCare passively analyzes the user's biomechanics in the background using "Zero-UI" automation.
- **Keystroke Dynamics**: Silently records `Dwell Mean` (ms held) and `Flight Mean` (ms between keys) during standard journal journaling to detect micro-hesitations linked to neuro-motor decline.
- **Active IMU Micro-tremor Tracking**: Integrates the native `DeviceMotionEvent` API to record smartphone accelerometer and gyroscope data. Piped into a Fast Fourier Transform (FFT) pipeline, it identifies 4-6 Hz resting tremor frequencies characteristic of neurological conditions.

---

## 🛡️ Anti-Spoofing & SQI Fallback
Camera-based health metrics are fragile. KinetiCare integrates an industrial **Signal Quality Index (SQI)** pipeline to combat biometric interference:
- Identifies LAPLACIAN variance manipulation (e.g., Beauty Filters, Deepfakes) and motion blur.
- Actively simulates **Kalman Filter** recovery logic when frame continuity degrades.
- Gracefully rejects spoofed video feeds with a Biometric Interference penalty without crashing the core medical extraction.

## ⚕️ HuatuoGPT-o1 Clinical Orchestrator
To guarantee a 0% failure rate, the Python backend intercepts the massive data streams and routes them to a master orchestrator:
- **Zero-Crash Rules Engine**: If the 7GB Huatuo LLM is unable to allocate RAM, the Orchestrator instantly falls back to a deterministic, zero-latency clinical rules engine, meaning the UI *never* encounters a 503 HTTP timeout.
- Delivers unified clinical decision support (Level 1/2/3 Risk Bands) straight to the React frontend.

---

## 📱 Progressive Web App (PWA)
KinetiCare is fully engineered as an installable **Progressive Web App (PWA)** for iOS and Android.
- Bypasses the App Store completely with `appleWebApp` configuration.
- Instantly installable to your Home Screen with a premium native app icon.
- Features offline Service Worker caching (`@ducanh2912/next-pwa`).

---

## ⚙️ Quick Start Installation

Ensure you have **Node.js 18+** and **Python 3.10+** installed on your system.

```bash
# Clone the repository
git clone https://github.com/student-srijit/health-ai-iit-bhu.git
cd health-ai-iit-bhu

# 1. Macro Setup (Installs all Next.js and Python FastAPI dependencies)
npm run setup:all

# 2. Start the Master Development Server
# This parallelizes the Next.js frontend (Port 3000) alongside
# the 4 Python Microservices (Depression, PPG, KinetiCare, Orchestrator)
npm run dev:all
```

Navigate to `http://localhost:3000` on your smartphone (or desktop) to begin your non-invasive clinical capture.

## Persistence and Longitudinal APIs (Phase 1)

The web app now supports MongoDB-backed persistence for assessments, prescriptions, and monitoring workflows.

### Environment variables (apps/web)

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=health_ai
```

### New API endpoints

- `POST /api/prescriptions` creates clinician prescriptions with interaction warnings and lifecycle status.
- `GET /api/prescriptions?patientId=<id>` lists patient prescriptions.
- `POST /api/monitoring-schedules` upserts per-patient daily check schedules.
- `GET /api/monitoring-schedules?patientId=<id>` reads current patient schedule.
- `POST /api/monitoring-checkins` stores scheduled/completed/missed/escalated check-ins.
- `GET /api/monitoring-checkins?patientId=<id>&days=30` returns recent check-ins.
- `GET /api/patient-history?patientId=<id>&limit=50&days=30` returns longitudinal patient timeline.

### Docker local database

`infra/docker-compose.yml` now includes a local `mongodb` service exposed on port `27017`.

---
*Built for the future of decentralized, zero-UI Clinical Diagnostics.*
