"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PPGResult {
  ppgSignal: number[];
  samplingRateHz: number;
  signalQuality: number;
}

interface PPGCaptureProps {
  onCapture: (data: PPGResult) => void;
  duration?: number;
}

export default function PPGCapture({ onCapture, duration = 15 }: PPGCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);
  const greenValuesRef = useRef<number[]>([]);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number>(0);

  const [phase, setPhase] = useState<"idle" | "capturing" | "processing" | "done" | "error">("idle");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [hasFlash, setHasFlash] = useState<boolean | null>(null);

  const stopAll = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  const getGreenMean = useCallback((): number => {
    if (!videoRef.current || !canvasRef.current) return 0;
    const canvas = canvasRef.current;
    canvas.width = 40;
    canvas.height = 30;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(videoRef.current, 0, 0, 40, 30);
    const data = ctx.getImageData(0, 0, 40, 30).data;
    let g = 0;
    for (let i = 0; i < data.length; i += 4) g += data[i + 1];
    return g / (data.length / 4) / 255;
  }, []);

  const drawGraph = useCallback(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const vals = greenValuesRef.current;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (vals.length < 2) return;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 0.001;

    ctx.strokeStyle = "#14b8a6";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#14b8a6";
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const step = w / (vals.length - 1);
    vals.forEach((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h * 0.85 - h * 0.075;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, []);

  const captureFrameAndUpdate = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 160, 120);
    const frameB64 = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
    framesRef.current.push(frameB64);

    const gVal = getGreenMean();
    greenValuesRef.current.push(gVal);
    if (greenValuesRef.current.length > 200) greenValuesRef.current.shift();
    drawGraph();
  }, [drawGraph, getGreenMean]);

  const startCapture = useCallback(async () => {
    setError(null);
    setPhase("capturing");
    setTimeLeft(duration);
    framesRef.current = [];
    greenValuesRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 320, height: 240 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Hardware Edge Case: Attempt to turn on the flashlight (Torch)
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        // @ts-expect-error - torch is valid on mobile browsers but missing in strict TS DOM definitions
        if (capabilities.torch) {
          // @ts-expect-error
          await track.applyConstraints({ advanced: [{ torch: true }] });
          setHasFlash(true);
        } else {
          setHasFlash(false);
        }
      } catch (err) {
        console.warn("Torch API not supported on this device:", err);
        setHasFlash(false);
      }

      frameIntervalRef.current = setInterval(captureFrameAndUpdate, 100); // ~10 fps

      let remaining = duration;
      const ticker = setInterval(async () => {
        remaining -= 1;
        setTimeLeft(remaining);

        if (remaining <= 0) {
          clearInterval(ticker);
          stopAll();
          setPhase("processing");

          try {
            const res = await fetch("/api/analyze-ppg-video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ videoFrames: framesRef.current.slice(0, 120), targetFps: 10 }),
            });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json() as {
              ppg_signal: number[];
              sampling_rate_hz: number;
              signal_quality: number;
            };

            setQuality(data.signal_quality);
            onCapture({
              ppgSignal: data.ppg_signal,
              samplingRateHz: data.sampling_rate_hz,
              signalQuality: data.signal_quality,
            });
            setPhase("done");
          } catch (err) {
            setError(err instanceof Error ? err.message : "PPG extraction failed");
            setPhase("error");
          }
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera access denied");
      setPhase("error");
    }
  }, [captureFrameAndUpdate, duration, onCapture, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  const progressPct = ((duration - timeLeft) / duration) * 100;
  const isCapturing = phase === "capturing";

  const qualityColor = quality !== null ? (quality > 0.5 ? "#22c55e" : quality > 0.2 ? "#f59e0b" : "#ef4444") : "#94a3b8";
  const qualityLabel = quality !== null ? (quality > 0.5 ? "Good" : quality > 0.2 ? "Fair" : "Poor") : "—";

  return (
    <div>
      {/* Instruction */}
      <div
        style={{
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.2)",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: "0.875rem",
          color: "#93c5fd",
        }}
      >
        💡 <strong>Instructions:</strong> Cover your phone&apos;s rear camera lens with your fingertip. 
        Press Start and hold still for {duration} seconds. The green channel in your skin reveals your pulse.
      </div>

      {/* Live PPG graph */}
      <div
        style={{
          background: "rgba(20,184,166,0.05)",
          border: isCapturing ? "1px solid rgba(20,184,166,0.4)" : "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          position: "relative",
          overflow: "hidden",
        }}
        className={isCapturing ? "recording-border" : ""}
      >
        <div className="label" style={{ marginBottom: 8 }}>Live Green-Channel Waveform</div>
        <canvas
          ref={graphCanvasRef}
          width={600}
          height={80}
          style={{ width: "100%", height: 80, display: "block" }}
        />

        {!isCapturing && phase !== "done" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", background: "rgba(5,12,24,0.7)", borderRadius: 12,
          }}>
            <span style={{ color: "#475569", fontSize: "0.85rem" }}>Waveform will appear during capture</span>
          </div>
        )}
      </div>

      {/* Hidden video + canvas for frame extraction */}
      <video ref={videoRef} style={{ display: "none" }} muted playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Progress */}
      {isCapturing && (
        <div style={{ marginBottom: 12 }}>
          {hasFlash === false && (
            <div className="disclaimer" style={{ marginBottom: 16, background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)", color: "#fbbf24" }}>
              <span className="disclaimer-icon">⚠</span> <strong>Hardware Edge Case (No Flash Detected):</strong> You are likely using a laptop webcam. Please strongly illuminate your finger with a desk lamp, or switch to a smartphone for clinical-grade illumination.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span className="text-sm text-muted">Capturing PPG…</span>
            <span className="text-sm" style={{ color: "#14b8a6", fontWeight: 700 }}>{timeLeft}s left</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {(phase === "idle" || phase === "done" || phase === "error") && (
          <button
            className="btn btn-primary"
            onClick={startCapture}
            style={{ background: "linear-gradient(135deg, #f472b6, #a78bfa)" }}
          >
            💓 {phase === "done" ? "Re-capture" : `Start PPG Capture (${duration}s)`}
          </button>
        )}
        {isCapturing && (
          <button className="btn btn-danger" onClick={() => { stopAll(); setPhase("idle"); }}>
            ⏹ Cancel
          </button>
        )}
        {phase === "processing" && (
          <button className="btn btn-secondary" disabled>
            <span className="spinner" /> Extracting PPG…
          </button>
        )}
        {phase === "done" && quality !== null && (
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            Signal Quality:{" "}
            <span style={{ color: qualityColor }}>{qualityLabel} ({Math.round(quality * 100)}%)</span>
          </span>
        )}
      </div>

      {error && (
        <div className="disclaimer" style={{ marginTop: 12, background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#fca5a5" }}>
          ⚠ {error}. Simulated PPG values will be used.
        </div>
      )}
    </div>
  );
}
