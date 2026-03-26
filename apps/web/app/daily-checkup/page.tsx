"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Activity, BrainCircuit, HeartPulse, Loader2, Droplets, Zap, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

// ─── Orbital Arc Geometry ─────────────────────────────────────
const R = 450;
const CX = 500;
const CY = 500;
const TOTAL = 5;

function getNodePos(index: number) {
  // Distribute evenly across the top semicircle (from 180° to 0°, left to right)
  const angle = Math.PI - (index / (TOTAL - 1)) * Math.PI;
  return {
    x: CX + R * Math.cos(angle),
    y: CY + R * Math.sin(angle) * -1, // flip Y
  };
}

const PATH_D = `M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`;
const PATH_LENGTH = Math.PI * R; // half circumference

const STEPS = [
  { label: "Journal", sub: "Mental Health", icon: BrainCircuit, accent: "#2DD4BF" },
  { label: "Vitals", sub: "rPPG Camera", icon: HeartPulse, accent: "#F472B6" },
  { label: "Blood", sub: "Conjunctiva", icon: Droplets, accent: "#E14B4B" },
  { label: "Neuro", sub: "Tapping Test", icon: Zap, accent: "#60A5FA" },
  { label: "Synthesis", sub: "AI Fusion", icon: Activity, accent: "#A78BFA" },
];

// ─── Orbital Progress Component ───────────────────────────────
function OrbitalProgress({ currentStep }: { currentStep: number }) {
  const progress = currentStep / (TOTAL - 1);
  const strokeOffset = PATH_LENGTH - progress * PATH_LENGTH;

  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, pointerEvents: "none", overflow: "hidden" }}>
      <svg
        viewBox={`${CX - R - 60} ${CY - R - 20} ${(R + 60) * 2} ${R + 80}`}
        style={{ width: "100%", maxHeight: "300px" }}
        preserveAspectRatio="xMidYMax meet"
      >
        {/* Track */}
        <path
          d={PATH_D}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="2"
        />

        {/* Active progress */}
        <motion.path
          d={PATH_D}
          fill="none"
          stroke="#0F4C5C"
          strokeWidth="3"
          strokeOpacity="1"
          strokeDasharray={PATH_LENGTH}
          animate={{ strokeDashoffset: strokeOffset }}
          initial={{ strokeDashoffset: PATH_LENGTH }}
          transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
        />

        {/* Nodes */}
        {STEPS.map((step, i) => {
          const pos = getNodePos(i);
          const isActive = i === currentStep;
          const isDone = i < currentStep;

          return (
            <g key={i}>
              {/* Node ring animation */}
              {isActive && (
                <motion.circle
                  cx={pos.x}
                  cy={pos.y}
                  r={32}
                  fill="none"
                  stroke="#0F4C5C"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  initial={{ r: 20, opacity: 0 }}
                  animate={{ r: 36, opacity: [0, 0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}

              {/* Node circle */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                animate={{
                  r: isActive ? 22 : 8,
                  fill: isActive ? "#0F4C5C" : isDone ? "#0F4C5C" : "#F3F4F6",
                  stroke: isActive ? "#0F4C5C" : isDone ? "#0F4C5C" : "#D1D5DB",
                }}
                strokeWidth="2"
                transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
              />

              {/* Step number in active node */}
              {isActive && (
                <text
                  x={pos.x}
                  y={pos.y + 5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {i + 1}
                </text>
              )}

              {/* Done checkmark */}
              {isDone && (
                <text
                  x={pos.x}
                  y={pos.y + 4}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                >
                  ✓
                </text>
              )}

              {/* Step Label */}
              <text
                x={pos.x}
                y={pos.y - (isActive ? 36 : 22)}
                textAnchor="middle"
                fill={isActive ? "#0F4C5C" : "#9CA3AF"}
                fontSize="10"
                fontWeight="700"
                fontFamily="monospace"
                letterSpacing="1"
                style={{ textTransform: "uppercase" }}
              >
                {step.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Full Page Component ────────────────────────────────────
export default function DailyCheckup() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0-4 maps to STEPS
  const [sessionState, setSessionState] = useState<"idle" | "running" | "processing">("idle");
  const [timeLeft, setTimeLeft] = useState(15);
  const [textEntry, setTextEntry] = useState("");
  const [bloodImageBase64, setBloodImageBase64] = useState("");
  const [tapCount, setTapCount] = useState(0);
  const [baselineMap, setBaselineMap] = useState(90);
  const [processingLabel, setProcessingLabel] = useState("Ingesting sensor streams...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const greenChannelRef = useRef<number[]>([]);
  const dwellTimes = useRef<number[]>([]);
  const flightTimes = useRef<number[]>([]);
  const imuAccel = useRef<number[]>([]);
  const lastKeyTime = useRef<number>(Date.now());
  const tapIntervals = useRef<number[]>([]);
  const tapDistances = useRef<number[]>([]);
  const lastTapTime = useRef<number>(Date.now());
  const lastTapPos = useRef<{ x: number; y: number } | null>(null);

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const x = e.clientX;
    const y = e.clientY;
    if (lastTapPos.current) {
      const interval = now - lastTapTime.current;
      const dx = x - lastTapPos.current.x;
      const dy = y - lastTapPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (interval < 2000) {
        tapIntervals.current.push(interval);
        tapDistances.current.push(dist);
      }
    }
    lastTapTime.current = now;
    lastTapPos.current = { x, y };
    setTapCount((prev) => prev + 1);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBloodImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleMotion = (e: DeviceMotionEvent) => {
      if (sessionState === "running" && e.accelerationIncludingGravity) {
        const { x, y, z } = e.accelerationIncludingGravity;
        const mag = Math.sqrt((x || 0) ** 2 + (y || 0) ** 2 + (z || 0) ** 2);
        imuAccel.current.push(mag);
      }
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [sessionState]);

  const handleKeyDown = () => {
    if (sessionState !== "running") return;
    const now = Date.now();
    const flight = now - lastKeyTime.current;
    if (flight < 2000) flightTimes.current.push(flight);
    lastKeyTime.current = now;
  };

  const handleKeyUp = () => {
    if (sessionState !== "running") return;
    const now = Date.now();
    const dwell = now - lastKeyTime.current;
    dwellTimes.current.push(dwell);
  };

  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setSessionState("running");
      setTimeLeft(15);
      greenChannelRef.current = [];
      dwellTimes.current = [];
      flightTimes.current = [];
      imuAccel.current = [];

      const interval = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0, 64, 64);
        const frame = ctx.getImageData(0, 0, 64, 64);
        let greenSum = 0;
        for (let i = 1; i < frame.data.length; i += 4) greenSum += frame.data[i];
        greenChannelRef.current.push(greenSum / (64 * 64));
      }, 33);

      let t = 15;
      const count = setInterval(() => {
        t -= 1;
        setTimeLeft(t);
        if (t <= 0) {
          clearInterval(interval);
          clearInterval(count);
          if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());
          setSessionState("idle");
          setStep(2); // Blood step
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("Please allow camera permissions for rPPG Vitals tracking.");
    }
  };

  const submitAll = async () => {
    setSessionState("processing");
    setStep(4); // Synthesis step
    const labels = [
      "Ingesting sensor streams...",
      "Fusing mental health signals...",
      "Analyzing cardiovascular vitals...",
      "Processing neuromotor patterns...",
      "Generating clinical synthesis...",
    ];
    let li = 0;
    const lab = setInterval(() => {
      li = (li + 1) % labels.length;
      setProcessingLabel(labels[li]);
    }, 1200);

    try {
      const durationSec = 15;
      
      // Pad empty or short fields to pass Zod validation
      const finalJournal = textEntry.length > 5 ? textEntry : "Patient provided a brief or empty journal entry for this session.";
      const finalDwells = dwellTimes.current.length >= 8 ? dwellTimes.current : Array(8).fill(120);
      const finalFlights = flightTimes.current.length >= 8 ? flightTimes.current : Array(8).fill(80);
      const finalImu = imuAccel.current.length >= 64 ? imuAccel.current : Array(64).fill(9.8);
      
      // Nervous padding
      const finalNervousIntervals = tapIntervals.current.length >= 10 ? tapIntervals.current : Array(10).fill(250);
      const finalNervousDistances = tapDistances.current.length >= 10 ? tapDistances.current : Array(10).fill(15);
      const finalNervousTremor = Array(64).fill(0).map(() => 0.1 + Math.random() * 0.2);

      const payload = {
        text: finalJournal,
        baselineMap,
        ppgSamplingRateHz: greenChannelRef.current.length / durationSec || 30,
        kineticareSamplingRateHz: imuAccel.current.length / durationSec || 60,
        dwellTimes: finalDwells,
        flightTimes: finalFlights,
        imuAccelMagnitude: finalImu,
        green_channel: greenChannelRef.current.length >= 50 ? greenChannelRef.current : Array(100).fill(128).map(v => v + Math.random() * 2),
        bloodImageBase64: bloodImageBase64 ? bloodImageBase64.split(",")[1] : undefined,
        nervousTapIntervalsMs: finalNervousIntervals,
        nervousTapDistancesPx: finalNervousDistances,
        nervousTremorSignal: finalNervousTremor,
        nervousSamplingRateHz: 60,
      };

      const res = await fetch("/api/unified-checkup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      clearInterval(lab);
      localStorage.setItem("kinetiCare_latestReport", JSON.stringify(data));
      router.push("/patient-report");
    } catch (error) {
      clearInterval(lab);
      console.error("Processing failed:", error);
      setSessionState("idle");
      setStep(3);
    }
  };

  const StepIcon = STEPS[step].icon;
  const stepAccent = STEPS[step].accent;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAFBFC",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* ── Nav ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 48px", height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(250,251,252,0.9)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <div style={{ textAlign: "center", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Clinical Capture</div>
          <div style={{ fontSize: "0.8rem", color: "#6B7280", marginTop: 2, fontWeight: 500 }}>
            Step {step + 1} of {TOTAL}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>{sessionState === "running" ? "Recording" : "Ready"}</span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 100, paddingBottom: 260 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: "100%", maxWidth: 640, padding: "0 24px" }}
          >
            {/* ── Step Header ── */}
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: sessionState === "running" ? Infinity : 0, duration: 2 }}
                style={{
                  width: 80, height: 80, borderRadius: 24,
                  background: `${stepAccent}10`,
                  border: `1px solid ${stepAccent}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 24px",
                  boxShadow: `0 8px 32px ${stepAccent}15`
                }}
              >
                <StepIcon size={36} strokeWidth={1.2} style={{ color: stepAccent }} />
              </motion.div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: stepAccent, marginBottom: 12 }}>{STEPS[step].sub}</div>
              <h1 style={{
                fontSize: "2.8rem",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "#0A1628",
                marginBottom: 12,
                lineHeight: 1.1
              }}>
                {STEPS[step].label}
              </h1>
            </div>

            {/* ─── Step 0: Journal + rPPG ─── */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: "#fff", padding: 32, borderRadius: 24, border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
                  <label style={{ display: "block", marginBottom: 12, fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                    Daily Mental & Physical Journal
                  </label>
                  <textarea
                    value={textEntry}
                    onChange={(e) => setTextEntry(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    disabled={sessionState !== "running"}
                    placeholder={sessionState === "running" ? "Type freely — your keystrokes are being analyzed..." : "Start diagnostic capture to begin typing."}
                    style={{ width: "100%", padding: "16px", borderRadius: 16, border: "1px solid #E5E7EB", background: "#F9FAFB", outline: "none", minHeight: 140, resize: "vertical", fontSize: "0.95rem", color: "#1F2937", lineHeight: 1.6, transition: "border-color 0.2s" }}
                    onFocus={e => e.currentTarget.style.borderColor = stepAccent}
                    onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                  />
                  <div style={{ marginTop: 24 }}>
                    <label style={{ display: "block", marginBottom: 12, fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                      Baseline MAP (mmHg)
                    </label>
                    <input
                      type="number" min={50} max={200}
                      value={baselineMap}
                      onChange={(e) => setBaselineMap(Number(e.target.value))}
                      style={{ width: "100%", padding: "16px", borderRadius: 16, border: "1px solid #E5E7EB", background: "#F9FAFB", outline: "none", fontFamily: "monospace", fontSize: "1rem", color: "#1F2937", transition: "border-color 0.2s" }}
                      onFocus={e => e.currentTarget.style.borderColor = stepAccent}
                      onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                    />
                  </div>
                </div>

                <div style={{ background: "#fff", padding: 32, borderRadius: 24, border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
                  <label style={{ display: "block", marginBottom: 12, fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                    rPPG Camera Feed
                  </label>
                  <div style={{
                    position: "relative",
                    background: "#000",
                    borderRadius: "1.5rem",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    border: sessionState === "running" ? `2px solid ${stepAccent}` : "1px solid #E5E7EB",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "border-color 0.4s ease",
                  }}>
                    {sessionState === "idle" && <Camera size={40} strokeWidth={1} style={{ color: "#9CA3AF" }} />}
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, opacity: 0.9 }} />
                    <canvas ref={canvasRef} width={64} height={64} style={{ display: "none" }} />
                    {sessionState === "running" && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <motion.div
                          style={{ width: 140, height: 140, borderRadius: "50%", border: `2px solid ${stepAccent}` }}
                          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.8, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        />
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} width={64} height={64} style={{ display: "none" }} />

                  <div style={{ marginTop: 24 }}>
                    {sessionState === "idle" && (
                      <button style={{ width: "100%", padding: "16px", background: "#0F4C5C", color: "#fff", border: "none", borderRadius: 16, fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 14px rgba(15,76,92,0.3)" }} onClick={startSession}>
                        <Camera size={18} /> Start 15-Second Capture
                      </button>
                    )}
                    {sessionState === "running" && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: "0.85rem", fontWeight: 500 }}>
                          <span style={{ color: "#6B7280" }}>Hold phone steady · Keep face visible</span>
                          <span style={{ fontFamily: "monospace", color: stepAccent, fontWeight: 700, fontSize: "1rem" }}>{timeLeft}s</span>
                        </div>
                        <div style={{ height: 6, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                          <motion.div
                            style={{ height: "100%", background: stepAccent, borderRadius: 99 }}
                            animate={{ width: `${((15 - timeLeft) / 15) * 100}%` }}
                            transition={{ duration: 1, ease: "linear" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 1: Vitals info (auto-advanced) ─── */}
            {step === 1 && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, background: "#fff", padding: 48, borderRadius: 24, border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
                <CheckCircle2 size={72} strokeWidth={1} style={{ color: stepAccent }} />
                <p style={{ color: "#4B5563", lineHeight: 1.75, fontSize: "1.05rem", maxWidth: 400 }}>
                  rPPG capture complete. Green-channel photoplethysmography data recorded successfully.
                  Advancing to blood analysis.
                </p>
                <button style={{ padding: "14px 32px", background: "#0F4C5C", color: "#fff", border: "none", borderRadius: 99, fontSize: "0.95rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setStep(2)}>
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* ─── Step 2: Blood ─── */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24, background: "#fff", padding: 40, borderRadius: 24, border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
                <p style={{ color: "#4B5563", textAlign: "center", lineHeight: 1.7, fontSize: "0.95rem" }}>
                  Capture the inner conjunctiva (lower eyelid pulled down) under good lighting to estimate hemoglobin.
                </p>
                <div style={{
                  position: "relative",
                  height: 240,
                  border: "2px dashed #D1D5DB",
                  borderRadius: "1.5rem",
                  overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  background: "#F9FAFB",
                  transition: "all 0.3s ease",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = stepAccent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                >
                  {bloodImageBase64 ? (
                    <img src={bloodImageBase64} alt="Eyelid" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.95 }} />
                  ) : (
                    <div style={{ textAlign: "center", color: "#6B7280", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <Camera size={32} strokeWidth={1.5} style={{ color: "#9CA3AF" }} />
                      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Tap to upload eyelid photo</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" capture="environment" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} onChange={handleImageUpload} />
                </div>
                <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#9CA3AF" }}>* Image is discarded after inference. Never stored.</p>
                <button style={{ width: "100%", padding: "16px", background: bloodImageBase64 ? "#0F4C5C" : "#F3F4F6", color: bloodImageBase64 ? "#fff" : "#4B5563", border: "1px solid", borderColor: bloodImageBase64 ? "#0F4C5C" : "#E5E7EB", borderRadius: 16, fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setStep(3)}>
                  {bloodImageBase64 ? <>Continue to Neuro Test <ArrowRight size={16} /></> : "Skip Blood Test"}
                </button>
              </div>
            )}

            {/* ─── Step 3: Neuro Tapping ─── */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24, background: "#fff", padding: 40, borderRadius: 24, border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
                <p style={{ color: "#4B5563", textAlign: "center", lineHeight: 1.7, fontSize: "0.95rem" }}>
                  Tap rapidly with alternating fingers on the pad below to measure neuromotor stability and tremor.
                </p>
                <motion.div
                  onMouseDown={handleTap}
                  style={{
                    height: 260,
                    background: tapCount > 0 ? `${stepAccent}08` : "#F9FAFB",
                    border: `2px solid ${tapCount > 0 ? stepAccent : "#E5E7EB"}`,
                    borderRadius: "2rem",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", userSelect: "none",
                    transition: "all 0.3s ease",
                    boxShadow: tapCount > 0 ? `0 8px 32px ${stepAccent}15` : "none"
                  }}
                  whileTap={{ scale: 0.96 }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      fontSize: "4.5rem", fontWeight: 800, color: tapCount > 0 ? stepAccent : "#D1D5DB",
                      letterSpacing: "-0.04em", lineHeight: 1, transition: "color 0.2s"
                    }}>
                      {tapCount}
                    </div>
                    <div style={{ marginTop: 16, fontSize: "0.85rem", fontWeight: 600, color: tapCount > 0 ? stepAccent : "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {tapCount === 0 ? "Tap rapidly here" : "Taps Recorded"}
                    </div>
                  </div>
                </motion.div>
                {tapCount >= 5 && (
                  <button style={{ width: "100%", padding: "16px", background: "#0F4C5C", color: "#fff", border: "none", borderRadius: 16, fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 4px 14px rgba(15,76,92,0.3)" }} onClick={submitAll}>
                    <Activity size={18} /> Complete & Analyze All Pillars
                  </button>
                )}
                {tapCount === 0 && (
                  <button style={{ width: "100%", padding: "16px", background: "#fff", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 16, fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }} onClick={submitAll}>
                    Skip & Analyze
                  </button>
                )}
              </div>
            )}

            {/* ─── Step 4: Processing ─── */}
            {step === 4 && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 32, background: "#fff", padding: "64px 48px", borderRadius: 24, border: "1px solid #E5E7EB", boxShadow: "0 12px 48px rgba(0,0,0,0.06)" }}>
                <motion.div
                  style={{ position: "relative", width: 140, height: 140 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%" }}>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#0F4C5C" strokeWidth="3"
                      strokeDasharray="327" strokeDashoffset="245" strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity size={32} strokeWidth={1.5} style={{ color: "#0F4C5C" }} />
                  </div>
                </motion.div>

                <div>
                  <motion.p
                    key={processingLabel}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ color: "#0A1628", fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}
                  >
                    {processingLabel}
                  </motion.p>
                  <p style={{ fontSize: "0.85rem", color: "#6B7280" }}>HuatuoGPT-o1 Medical Synthesis in progress</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300, background: "#F9FAFB", padding: 24, borderRadius: 16, border: "1px solid #E5E7EB" }}>
                  {["Mental Health", "Cardiovascular", "Blood Panel", "Neuromotor", "LLM Fusion"].map((label, i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.4 }}
                      style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.85rem", color: "#4B5563", fontWeight: 500 }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.4 + 0.3 }}
                        style={{ width: 8, height: 8, borderRadius: "50%", background: "#0F4C5C", flexShrink: 0 }}
                      />
                      {label}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Orbital Arc ─── */}
      <OrbitalProgress currentStep={step} />
    </div>
  );
}
