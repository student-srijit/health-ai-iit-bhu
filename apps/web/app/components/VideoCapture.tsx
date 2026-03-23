"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VideoCapture {
  audioFeatures: number[];
  videoFeatures: number[];
  framesProcessed: number;
}

interface VideoCaptureProps {
  onCapture: (data: VideoCapture) => void;
  duration?: number; // seconds
}

export default function VideoCapture({ onCapture, duration = 30 }: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<"idle" | "permission" | "recording" | "processing" | "done" | "error">("idle");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [error, setError] = useState<string | null>(null);
  const [framesCollected, setFramesCollected] = useState(0);

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
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setPhase("permission");
    framesRef.current = [];
    audioChunksRef.current = [];
    setFramesCollected(0);
    setTimeLeft(duration);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;

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
                videoFrames: framesRef.current.slice(0, 60),
                sampleRate: 44100,
              }),
            });

            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json() as {
              audio_features: number[];
              video_features: number[];
              frames_processed: number;
            };

            onCapture({
              audioFeatures: data.audio_features ?? [],
              videoFeatures: data.video_features ?? [],
              framesProcessed: data.frames_processed ?? 0,
            });
            setPhase("done");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Processing failed");
            setPhase("error");
          }
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera access denied");
      setPhase("error");
    }
  }, [captureFrame, duration, onCapture, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

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
          ⚠ {error}. You can still run analysis — simulated features will be used.
        </div>
      )}

      <div className="disclaimer" style={{ marginTop: 12 }}>
        🔒 Video and audio are processed locally. Nothing is stored on a server.
      </div>
    </div>
  );
}
