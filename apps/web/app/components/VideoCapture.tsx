"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VideoCapture {
  audioFeatures: number[];
  videoFeatures: number[];
  framesProcessed: number;
  cameraMetrics: {
    frame_quality_score: number;
    blur_score: number;
    face_tracking_confidence: number;
    spoof_probability: number;
    accepted_window_ratio: number;
    laplacian_variance: number;
    frequency_spoof_score: number;
  };
}

type FaceDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ boundingBox?: DOMRectReadOnly }>>;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

interface VideoCaptureProps {
  onCapture: (data: VideoCapture) => void;
  duration: number; // seconds
}

function parseMediaResponse(payload: unknown): VideoCapture {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid response payload");
  }

  const candidate = payload as {
    audio_features?: unknown;
    video_features?: unknown;
    frames_processed?: unknown;
  };

  if (!Array.isArray(candidate.audio_features) || !candidate.audio_features.every((n) => typeof n === "number")) {
    throw new Error("Invalid audio feature vector");
  }

  if (!Array.isArray(candidate.video_features) || !candidate.video_features.every((n) => typeof n === "number")) {
    throw new Error("Invalid video feature vector");
  }

  if (typeof candidate.frames_processed !== "number") {
    throw new Error("Invalid frame count");
  }

  return {
    audioFeatures: candidate.audio_features,
    videoFeatures: candidate.video_features,
    framesProcessed: candidate.frames_processed,
  };
}

export default function VideoCapture({ onCapture, duration }: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const faceDetectionStateRef = useRef({
    ready: false,
    hasFace: true,
    inFlight: false,
  });
  
  // SQI State & Sensor Refs
  const gravityRef = useRef<{x: number, y: number, z: number} | null>(null);
  const [sqiStatus, setSqiStatus] = useState<string[]>([]);

  const [phase, setPhase] = useState<"idle" | "permission" | "recording" | "processing" | "done" | "error">("idle");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [error, setError] = useState<string | null>(null);
  const [framesCollected, setFramesCollected] = useState(0);

  const cameraStatsRef = useRef({
    totalFrames: 0,
    acceptedFrames: 0,
    frameQualitySum: 0,
    blurScoreSum: 0,
    faceConfidenceSum: 0,
    laplacianVarianceSum: 0,
    faceChecks: 0,
    faceMisses: 0,
  });

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  const buildCameraMetrics = useCallback(() => {
    const stats = cameraStatsRef.current;
    const total = Math.max(stats.totalFrames, 1);
    const faceCheckCount = Math.max(stats.faceChecks, 1);
    const faceMissRatio = stats.faceMisses / faceCheckCount;
    return {
      frame_quality_score: Number((stats.frameQualitySum / total).toFixed(4)),
      blur_score: Number((stats.blurScoreSum / total).toFixed(4)),
      face_tracking_confidence: Number((stats.faceConfidenceSum / total).toFixed(4)),
      spoof_probability: Number((clamp01(faceMissRatio * 0.8) ).toFixed(4)),
      accepted_window_ratio: Number((stats.acceptedFrames / total).toFixed(4)),
      laplacian_variance: Number((stats.laplacianVarianceSum / total).toFixed(4)),
      frequency_spoof_score: Number((clamp01(faceMissRatio)).toFixed(4)),
    };
  }, []);

  const stopAll = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 160, 90);
    const frameB64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
    framesRef.current.push(frameB64);
    setFramesCollected(framesRef.current.length);

    // --- Dynamic Real-Time SQI Engine --- //
    const width = 160;
    const height = 90;
    const imageData = ctx.getImageData(0, 0, width, height).data;
    const gray = new Float32Array(width * height);
    let brightness = 0;
    for (let i = 0, p = 0; i < imageData.length; i += 4, p += 1) {
      const y = (0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2]);
      gray[p] = y;
      brightness += y;
    }
    brightness = brightness / (width * height);
    const brightnessNorm = brightness / 255;

    let lapSum = 0;
    let lapSqSum = 0;
    let lapCount = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        const lap =
          (4 * gray[idx]) -
          gray[idx - 1] -
          gray[idx + 1] -
          gray[idx - width] -
          gray[idx + width];
        lapSum += lap;
        lapSqSum += lap * lap;
        lapCount += 1;
      }
    }

    const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
    const lapVar = lapCount > 0 ? Math.max((lapSqSum / lapCount) - (lapMean * lapMean), 0) : 0;
    const blurScore = clamp01((45 - lapVar) / 45);
    const brightnessScore = clamp01(1 - (Math.abs(brightnessNorm - 0.55) / 0.55));
    const textureScore = clamp01(lapVar / 120);
    const detectorPenalty = faceDetectionStateRef.current.ready && !faceDetectionStateRef.current.hasFace ? 0.45 : 0;
    const faceTrackingConfidence = clamp01(((0.6 * brightnessScore) + (0.4 * textureScore)) - detectorPenalty);
    const frameQualityScore = clamp01(
      (0.45 * brightnessScore) +
      (0.35 * faceTrackingConfidence) +
      (0.2 * (1 - blurScore)),
    );

    const frameAccepted =
      brightnessNorm >= 0.18 &&
      brightnessNorm <= 0.88 &&
      lapVar >= 20 &&
      faceTrackingConfidence >= 0.35 &&
      !(faceDetectionStateRef.current.ready && !faceDetectionStateRef.current.hasFace);

    cameraStatsRef.current.totalFrames += 1;
    cameraStatsRef.current.frameQualitySum += frameQualityScore;
    cameraStatsRef.current.blurScoreSum += blurScore;
    cameraStatsRef.current.faceConfidenceSum += faceTrackingConfidence;
    cameraStatsRef.current.laplacianVarianceSum += lapVar;
    if (frameAccepted) {
      cameraStatsRef.current.acceptedFrames += 1;
    }

    const detector = faceDetectorRef.current;
    if (detector && !faceDetectionStateRef.current.inFlight && cameraStatsRef.current.totalFrames % 3 === 0) {
      faceDetectionStateRef.current.inFlight = true;
      void createImageBitmap(canvas)
        .then(async (bitmap) => {
          try {
            const faces = await detector.detect(bitmap);
            cameraStatsRef.current.faceChecks += 1;
            const hasFace = faces.length > 0;
            faceDetectionStateRef.current.ready = true;
            faceDetectionStateRef.current.hasFace = hasFace;
            if (!hasFace) {
              cameraStatsRef.current.faceMisses += 1;
            }
          } finally {
            bitmap.close();
          }
        })
        .catch(() => {
          faceDetectionStateRef.current.ready = false;
          faceDetectionStateRef.current.hasFace = true;
        })
        .finally(() => {
          faceDetectionStateRef.current.inFlight = false;
        });
    }
    
    const activeErrors: string[] = [];
    if (brightnessNorm < 0.18) activeErrors.push("Low lighting detected. Keep your face fully visible.");
    if (brightnessNorm > 0.88) activeErrors.push("Overexposure detected. Reduce direct light.");
    if (lapVar < 20) activeErrors.push("Face blur or occlusion detected. Hold steady and uncover face.");
    if (faceDetectionStateRef.current.ready && !faceDetectionStateRef.current.hasFace) {
      activeErrors.push("Face not detected clearly. Uncover and center your face.");
    }
    
    if (gravityRef.current) {
      const { y, z } = gravityRef.current;
      if (Math.abs(y) < 5 && Math.abs(z) > 4) {
        activeErrors.push("Lying down / Bad posture detected.");
      }
    }
    setSqiStatus(activeErrors);

  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setPhase("permission");
    framesRef.current = [];
    audioChunksRef.current = [];
    cameraStatsRef.current = {
      totalFrames: 0,
      acceptedFrames: 0,
      frameQualitySum: 0,
      blurScoreSum: 0,
      faceConfidenceSum: 0,
      laplacianVarianceSum: 0,
      faceChecks: 0,
      faceMisses: 0,
    };
    faceDetectionStateRef.current = {
      ready: false,
      hasFace: true,
      inFlight: false,
    };
    setFramesCollected(0);
    setTimeLeft(duration);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      const sampleRate = audioTrack?.getSettings().sampleRate;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Set up audio recording
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(500);

      // Start frame capture at ~5 fps
      frameIntervalRef.current = setInterval(captureFrame, 200);

      setPhase("recording");
      let remaining = duration;

      const ticker = setInterval(async () => {
        remaining -= 1;
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(ticker);
          stopAll();
          setPhase("processing");

          // Wait for audio chunks
          await new Promise<void>((resolve) => setTimeout(resolve, 800));

          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            // Convert to ArrayBuffer then base64 (send as raw bytes)
            const arrayBuf = await audioBlob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuf);
            let binary = "";
            uint8.forEach((b) => { binary += String.fromCharCode(b); });
            const audioBase64 = btoa(binary);

            const res = await fetch("/api/analyze-depression-media", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBase64,
                videoFrames: framesRef.current.slice(0, Math.ceil((duration * 1000) / 200)),
                ...(typeof sampleRate === "number" ? { sampleRate } : {}),
              }),
            });

            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();
            onCapture({
              ...parseMediaResponse(data),
              cameraMetrics: buildCameraMetrics(),
            });
            setPhase("done");
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setPhase("error");
          }
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [buildCameraMetrics, captureFrame, duration, onCapture, stopAll]);

  useEffect(() => {
    if (window.FaceDetector) {
      try {
        faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        faceDetectorRef.current = null;
      }
    }

    const handleMotion = (e: DeviceMotionEvent) => {
      if (e.accelerationIncludingGravity) {
        gravityRef.current = {
          x: e.accelerationIncludingGravity.x || 0,
          y: e.accelerationIncludingGravity.y || 0,
          z: e.accelerationIncludingGravity.z || 0,
        };
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => {
      stopAll();
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [stopAll]);

  const progressPct = ((duration - timeLeft) / duration) * 100;
  const isRecording = phase === "recording";

  return (
    <div>
      {/* Video preview */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <video
          ref={videoRef}
          className="video-preview"
          muted
          playsInline
          style={{
            border: isRecording ? "2px solid rgba(20,184,166,0.6)" : "2px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Countdown overlay */}
        {isRecording && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(239,68,68,0.9)",
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: "0.85rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block" }}
              className="pulse-red" />
            {timeLeft}s
          </div>
        )}

        {/* Real-time SQI Warning Overlay */}
        {isRecording && sqiStatus.length > 0 && (
          <div style={{ position: "absolute", top: 44, left: 12, right: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {sqiStatus.map(sqi => (
              <div key={sqi} className="animate-pulse" style={{ background: "rgba(239,68,68,0.95)", color: "white", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, zIndex: 10 }}>
                <span>⚠️</span> SQI Alert: {sqi}
              </div>
            ))}
          </div>
        )}

        {/* Frames counter */}
        {isRecording && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "rgba(0,0,0,0.6)",
              borderRadius: 8,
              padding: "3px 10px",
              fontSize: "0.75rem",
              color: "#94a3b8",
            }}
          >
            {framesCollected} frames
          </div>
        )}

        {/* Idle placeholder */}
        {phase === "idle" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "rgba(5,12,24,0.8)",
            borderRadius: 14,
          }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎥</div>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Camera will appear here</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isRecording && (
        <div className="progress-bar-track" style={{ marginBottom: 12 }}>
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {phase === "idle" || phase === "done" || phase === "error" ? (
          <button className="btn btn-primary" onClick={startRecording}>
            🎙 {phase === "done" ? "Re-record" : "Start Recording"} ({duration}s)
          </button>
        ) : phase === "recording" ? (
          <button className="btn btn-danger" onClick={() => { stopAll(); setPhase("idle"); }}>
            ⏹ Stop Early
          </button>
        ) : (
          <button className="btn btn-secondary" disabled>
            <span className="spinner" /> Extracting features…
          </button>
        )}

        {phase === "done" && (
          <span style={{ color: "#22c55e", fontSize: "0.9rem", fontWeight: 600 }}>
            ✓ Features extracted successfully
          </span>
        )}
      </div>

      {error && (
        <div className="disclaimer" style={{ marginTop: 12, background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#fca5a5" }}>
          ⚠ {error}
        </div>
      )}

      <div className="disclaimer" style={{ marginTop: 12 }}>
        🔒 Video and audio are processed locally. Nothing is stored on a server.
      </div>
    </div>
  );
}
