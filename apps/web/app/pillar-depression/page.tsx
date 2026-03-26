"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Reveal, RevealMask, CountUp } from "../components/AnimationUtils";
import VideoCapture from "../components/VideoCapture";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import HuatuoChat from "../components/HuatuoChat";
import { ArrowLeft, Brain, Activity, Camera, FileText, ChevronRight, ShieldCheck, Cpu } from "lucide-react";

interface CapturedFeatures {
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

interface DepressionResult {
  patient_id: string;
  depression_score: number;
  risk_band: string;
  confidence: number;
  modalities_used: string[];
  status: string;
  error_message?: string | null;
  camera_sqi?: number | null;
}

interface KineticareResult {
  risk_band: string;
  session_quality: string;
  feature_summary: {
    dwell_mean_ms: number;
    flight_mean_ms: number;
    tremor_ratio_4_6hz: number;
  };
}

interface OrchestratorResult {
  overall_risk: string;
  llm_response: string;
}

interface AnalysisPayload {
  depression?: DepressionResult;
  kineticare?: KineticareResult;
  orchestrator?: OrchestratorResult;
  patient_id?: string;
  warnings?: string[];
}

// ─── Custom Brain SVG (not AI-generated) ─────────────────────
function BrainWaveGlyph() {
  return (
    <svg viewBox="0 0 120 120" fill="none" style={{ width: "100%", height: "100%" }}>
      {/* Center circle */}
      <circle cx="60" cy="60" r="28" stroke="#2DD4BF" strokeWidth="1" strokeOpacity="0.3" />
      <circle cx="60" cy="60" r="18" stroke="#2DD4BF" strokeWidth="1" strokeOpacity="0.2" fill="#2DD4BF" fillOpacity="0.04"/>
      {/* Radiating rings */}
      <circle cx="60" cy="60" r="42" stroke="#2DD4BF" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="4 6"/>
      <circle cx="60" cy="60" r="56" stroke="#2DD4BF" strokeWidth="0.5" strokeOpacity="0.08" strokeDasharray="2 8"/>
      {/* Cross hairs */}
      <line x1="60" y1="10" x2="60" y2="50" stroke="#2DD4BF" strokeWidth="0.8" strokeOpacity="0.4"/>
      <line x1="60" y1="70" x2="60" y2="110" stroke="#2DD4BF" strokeWidth="0.8" strokeOpacity="0.4"/>
      <line x1="10" y1="60" x2="50" y2="60" stroke="#2DD4BF" strokeWidth="0.8" strokeOpacity="0.4"/>
      <line x1="70" y1="60" x2="110" y2="60" stroke="#2DD4BF" strokeWidth="0.8" strokeOpacity="0.4"/>
      {/* EEG wave */}
      <path d="M 20 60 L 35 60 L 40 45 L 45 75 L 50 55 L 55 65 L 60 60 L 65 55 L 70 65 L 75 45 L 80 75 L 85 60 L 100 60" 
        stroke="#2DD4BF" strokeWidth="1.5" strokeOpacity="0.7" fill="none" strokeLinecap="round"/>
      {/* Corner nodes */}
      {[[18,18],[102,18],[18,102],[102,102]].map(([x,y],i) => (
        <rect key={i} x={x-4} y={y-4} width="8" height="8" rx="2" fill="none" stroke="#2DD4BF" strokeWidth="1" strokeOpacity="0.3"/>
      ))}
    </svg>
  );
}

export default function PillarDepressionPage() {
  const [journalText, setJournalText] = useState("");
  const [features, setFeatures] = useState<CapturedFeatures | null>(null);
  const [result, setResult] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulateSpoof, setSimulateSpoof] = useState(false);
  const patientIdRef = useRef<string>(crypto.randomUUID());

  // KinetiCare Sensors — preserved exactly
  const keyPressMap = useRef<Record<string, number>>({});
  const lastKeyRelease = useRef<number | null>(null);
  const imuFirstTs = useRef<number | null>(null);
  const imuLastTs = useRef<number | null>(null);
  const dwellTimes = useRef<number[]>([]);
  const flightTimes = useRef<number[]>([]);
  const imuBuffer = useRef<number[]>([]);

  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (acc) {
        const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
        if (mag > 0) {
          imuBuffer.current.push(mag);
          const now = performance.now();
          if (imuFirstTs.current === null) imuFirstTs.current = now;
          imuLastTs.current = now;
        }
      }
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const now = performance.now();
    if (!keyPressMap.current[e.key]) {
      keyPressMap.current[e.key] = now;
      if (lastKeyRelease.current) flightTimes.current.push(now - lastKeyRelease.current);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    const now = performance.now();
    const pressedAt = keyPressMap.current[e.key];
    if (pressedAt) {
      dwellTimes.current.push(now - pressedAt);
      delete keyPressMap.current[e.key];
    }
    lastKeyRelease.current = now;
  };

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const imuRate =
        imuFirstTs.current !== null && imuLastTs.current !== null && imuLastTs.current > imuFirstTs.current
          ? imuBuffer.current.length / ((imuLastTs.current - imuFirstTs.current) / 1000)
          : null;

      const requestBody: Record<string, unknown> = {
        journalText, baselineMap: 90, useCamera: !!features, simulateSpoof,
        audioFeatures: features?.audioFeatures,
        videoFeatures: features?.videoFeatures,
        cameraMetrics: features?.cameraMetrics,
        patientId: patientIdRef.current,
      };

      if (imuRate && dwellTimes.current.length >= 8 && flightTimes.current.length >= 8 && imuBuffer.current.length >= 64) {
        requestBody.dwellTimes = dwellTimes.current;
        requestBody.flightTimes = flightTimes.current;
        requestBody.imuAccelMagnitude = imuBuffer.current;
        requestBody.kineticareSamplingRateHz = imuRate;
      }

      const res = await fetch("/api/run-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as AnalysisPayload;
      if (data.patient_id) patientIdRef.current = data.patient_id;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const depression = result?.depression;
  const kineticare = result?.kineticare;
  const orchestrator = result?.orchestrator;
  const huatuoPrompt = depression && orchestrator ? `You are HuatuoGPT-o1. System output: ${orchestrator.llm_response}` : undefined;

  return (
    <div style={{ background: "#FAFBFC", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top nav strip ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(250,251,252,0.9)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "0 48px", height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2DD4BF", boxShadow: "0 0 6px #2DD4BF80" }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Pillar I · Mental Health</span>
        </div>
        <button
          onClick={() => void runAnalysis()}
          disabled={loading || !journalText.trim()}
          style={{
            padding: "9px 24px",
            background: loading ? "#9CA3AF" : "#0F4C5C",
            color: "#fff",
            border: "none",
            borderRadius: 99,
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 8,
            transition: "all 0.25s",
            boxShadow: loading ? "none" : "0 4px 14px rgba(15,76,92,0.3)",
          }}
        >
          {loading ? (
            <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff6", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Analyzing…</>
          ) : (
            <>Run Analysis <ChevronRight size={14} /></>
          )}
        </button>
      </div>

      {/* ══════════ HERO SECTION ══════════ */}
      <section style={{
        paddingTop: 120, paddingBottom: 100,
        padding: "120px 48px 100px",
        maxWidth: 1280, margin: "0 auto",
        display: "flex", alignItems: "center", gap: 80,
      }}>
        {/* Text */}
        <div style={{ flex: "0 0 55%" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px",
            background: "rgba(45,212,191,0.08)",
            border: "1px solid rgba(45,212,191,0.2)",
            borderRadius: 99,
            marginBottom: 28,
          }}>
            <Brain size={12} style={{ color: "#2DD4BF" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#2DD4BF" }}>Pillar I — Digital Phenotype</span>
          </div>
          <h1 style={{
            fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
            color: "#0A1628",
            marginBottom: 24,
            animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 0ms both",
          }}>
            Psychiatric Diagnostics<br />
            <span style={{ color: "#2DD4BF" }}>Without a Therapist.</span>
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#6B7280", lineHeight: 1.75, maxWidth: 520, marginBottom: 36, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 150ms both" }}>
            Multimodal mental health extraction analyzing vocal biomarkers, facial micro-expressions, sentiment embeddings, and invisible keystroke dynamics via LSTM-Highway fusion.
          </p>
          {/* Bullet benefits */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 250ms both" }}>
            {["30-second passive facial telemetry", "Anti-spoofing & Quality Signal Index (SQI)", "Invisible KinetiCare keystroke biometrics", "HuatuoGPT-o1 clinical reasoning fusion"].map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2DD4BF", flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: "#4B5563", fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right glyph — custom SVG, not generic icon */}
        <div style={{ flex: "0 0 45%", display: "flex", justifyContent: "center", animation: "slideInRight 1s cubic-bezier(0.22,1,0.36,1) 200ms both" }}>
          <div style={{ position: "relative", width: 340, height: 340 }}>
            {/* Outer glow */}
            <div style={{
              position: "absolute", inset: -40,
              background: "radial-gradient(circle, rgba(45,212,191,0.08) 0%, transparent 70%)",
              borderRadius: "50%",
              animation: "pulse 4s ease-in-out infinite",
            }} />
            <div style={{
              width: "100%", height: "100%",
              background: "#fff",
              borderRadius: "50%",
              border: "1px solid rgba(45,212,191,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 24px 80px rgba(45,212,191,0.12)",
              padding: 32,
            }}>
              <BrainWaveGlyph />
            </div>
            {/* Floating stat badges */}
            {[
              { label: "94%", sub: "Accuracy", top: -10, right: -20 },
              { label: "30s", sub: "Capture", bottom: 20, left: -30 },
              { label: "3×", sub: "Modalities", bottom: -10, right: 30 },
            ].map(({ label, sub, ...pos }) => (
              <div key={label} style={{
                position: "absolute", ...pos,
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 16,
                padding: "12px 18px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                textAlign: "center",
                backdropFilter: "blur(8px)",
              }}>
                <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "#0A1628", lineHeight: 1 }}>{label}</div>
                <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <Reveal>
        <div style={{ borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", padding: "32px 48px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {[
              { n: 94, s: "%", label: "Depression classification accuracy" },
              { n: 30, s: "s", label: "Passive facial capture window" },
              { n: 3, s: "×", label: "Signal modalities fused" },
              { n: 100, s: "%", label: "On-device — no video stored" },
            ].map(({ n, s, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  <CountUp target={n} suffix={s} />
                </div>
                <p style={{ fontSize: "0.8rem", color: "#9CA3AF", marginTop: 8, fontWeight: 500 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ══════════ MAIN ANALYSIS PANEL ══════════ */}
      <section style={{ padding: "80px 48px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>

          {/* ── Left: Inputs ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Reveal>
              <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Camera size={18} style={{ color: "#2DD4BF" }} />
                    </div>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1rem", margin: 0 }}>30-Second Facial Telemetry</h3>
                  </div>
                  {features && (
                    <div style={{ padding: "4px 12px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 99 }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16A34A" }}>✓ READY</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.65, marginBottom: 20 }}>
                  Execute a 30-second localized capture. Only vector projections are relayed — raw video never leaves your device.
                </p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: "#F3F4F6", border: "1px solid #E5E7EB" }}>
                  <VideoCapture onCapture={setFeatures} duration={30} />
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={18} style={{ color: "#2DD4BF" }} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1rem", margin: 0 }}>Linguistic Sentiment Log</h3>
                    <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: 0, letterSpacing: "0.06em", fontWeight: 600, textTransform: "uppercase" }}>Keystroke biometrics active</p>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={journalText}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  onChange={(e) => setJournalText(e.target.value)}
                  placeholder="Describe how you are feeling today. Your keystrokes are being passively analyzed for dwell and flight timings…"
                  style={{
                    width: "100%", padding: "16px", borderRadius: 16,
                    border: "1px solid #E5E7EB",
                    background: "#F9FAFB",
                    fontSize: "0.9rem", color: "#374151", lineHeight: 1.7,
                    outline: "none", resize: "vertical",
                    fontFamily: "inherit",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#2DD4BF"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#6B7280", cursor: "pointer" }}>
                    <input type="checkbox" checked={simulateSpoof} onChange={e => setSimulateSpoof(e.target.checked)} style={{ accentColor: "#2DD4BF" }} />
                    Simulate camera deepfake (anti-spoof demo)
                  </label>
                  <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>{journalText.length} chars</span>
                </div>
                {error && (
                  <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, fontSize: "0.85rem", color: "#DC2626" }}>
                    ⚠ {error}
                  </div>
                )}
              </div>
            </Reveal>
          </div>

          {/* ── Right: Results ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {depression && kineticare ? (
              <>
                {/* Anti-spoof alert */}
                {depression.status === "blocked" && (
                  <Reveal>
                    <div style={{ padding: 24, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20 }}>
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <ShieldCheck size={20} style={{ color: "#DC2626", flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <h4 style={{ margin: 0, color: "#DC2626", fontWeight: 700, marginBottom: 6 }}>Biometric Interference Detected</h4>
                          <p style={{ margin: 0, color: "#6B7280", fontSize: "0.875rem", lineHeight: 1.65 }}>
                            Anti-Spoofing & SQI pipeline triggered. Disable camera filters and ensure natural lighting. Falling back to KinetiCare neuromotor tracking.
                          </p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                )}

                {/* Risk ring */}
                <Reveal>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <RiskBadge risk={orchestrator?.overall_risk || depression.risk_band} score={depression.depression_score} size="lg" label="Overall Neural Risk" />
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 20, padding: "6px 16px", background: "#F3F4F6", borderRadius: 99 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280" }}>Camera Status:</span>
                      <span style={{ fontWeight: 800, color: depression.status === "blocked" ? "#DC2626" : "#16A34A", fontSize: "0.8rem" }}>
                        {depression.status === "blocked" ? "⛔ Rejected" : "✓ " + depression.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </Reveal>

                {/* Modalities used */}
                <Reveal delay={80}>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", marginBottom: 20, fontSize: "1rem" }}>Active Signal Modalities</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {depression.modalities_used.map((m: string) => (
                        <div key={m} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#F9FAFB", borderRadius: 12, border: "1px solid #E5E7EB" }}>
                          <Activity size={14} style={{ color: "#2DD4BF" }} />
                          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#374151" }}>{m}</span>
                        </div>
                      ))}
                    </div>
                    {depression.camera_sqi != null && (
                      <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #E5E7EB" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Camera SQI</span>
                        <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "1.6rem", color: "#0A1628", marginTop: 4 }}>{depression.camera_sqi.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                </Reveal>

                {/* KinetiCare Metrics */}
                <Reveal delay={120}>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", marginBottom: 20, fontSize: "1rem" }}>Neuromotor Telemetry</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <MetricCard icon="⌨️" label="Dwell/Flight" value={`${kineticare.feature_summary.dwell_mean_ms.toFixed(0)}/${kineticare.feature_summary.flight_mean_ms.toFixed(0)}`} unit="ms" accent={kineticare.risk_band === "high" ? "#DC2626" : "#2DD4BF"} />
                      <MetricCard icon="📳" label="Tremor 4–6Hz" value={kineticare.feature_summary.tremor_ratio_4_6hz.toFixed(3)} unit="ratio" accent={kineticare.feature_summary.tremor_ratio_4_6hz > 0.4 ? "#DC2626" : "#22C55E"} />
                      <MetricCard icon="📊" label="Phenotype Score" value={depression.depression_score.toFixed(3)} accent={depression.risk_band === "high" ? "#DC2626" : depression.risk_band === "medium" ? "#F59E0B" : "#22C55E"} />
                      <MetricCard icon="🎯" label="Confidence" value={`${Math.round(depression.confidence * 100)}%`} accent="#2DD4BF" />
                    </div>
                  </div>
                </Reveal>

                {/* HuatuoGPT */}
                <Reveal delay={160}>
                  <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <div style={{ background: "#0A1628", padding: "16px 28px", display: "flex", alignItems: "center", gap: 10 }}>
                      <Cpu size={16} style={{ color: "#2DD4BF" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>HuatuoGPT-o1 Clinical Reasoning</span>
                    </div>
                    <HuatuoChat prompt={huatuoPrompt} />
                  </div>
                </Reveal>

                {/* Warnings */}
                {result?.warnings?.map((w) => (
                  <div key={w} style={{ padding: "12px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, fontSize: "0.85rem", color: "#92400E" }}>
                    ⚠ {w}
                  </div>
                ))}
              </>
            ) : (
              <Reveal>
                <div style={{
                  background: "#fff",
                  borderRadius: 24,
                  border: "1.5px dashed #D1D5DB",
                  padding: 80,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", minHeight: 480, textAlign: "center",
                }}>
                  <div style={{ width: 80, height: 80, marginBottom: 28, opacity: 0.4 }}>
                    <Brain size={80} strokeWidth={0.8} style={{ color: "#D1D5DB" }} />
                  </div>
                  <h3 style={{ color: "#9CA3AF", fontWeight: 600, fontSize: "1.1rem", marginBottom: 10 }}>Awaiting Telemetry</h3>
                  <p style={{ color: "#D1D5DB", maxWidth: 280, fontSize: "0.875rem", lineHeight: 1.65 }}>
                    Fill in the journal and optionally complete the facial capture above, then run your analysis.
                  </p>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS — Process timeline section ══════════ */}
      <section style={{ background: "#F5F7FA", padding: "100px 48px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Reveal>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", color: "#2DD4BF", textTransform: "uppercase", marginBottom: 16 }}>Under The Hood</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#0A1628", marginBottom: 12 }}>How The Mental Health Pillar Works</h2>
            <p style={{ color: "#6B7280", fontSize: "1rem", maxWidth: 560, lineHeight: 1.7 }}>
              A three-stage ML pipeline fuses passive signals you don&apos;t even know you&apos;re providing.
            </p>
          </Reveal>
          {/* Step timeline */}
          <div style={{ position: "relative", marginTop: 72 }}>
            {/* Connecting line */}
            <div style={{ position: "absolute", top: 28, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, #2DD4BF40, transparent)" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
              {[
                { num: "01", title: "Capture", desc: "30-second facial telemetry via camera. Spoof detection + quality index." },
                { num: "02", title: "Extract", desc: "Audio pitch, speech velocity, NLP sentiment, and face landmark kinematics." },
                { num: "03", title: "Fuse", desc: "LSTM-Highway network merges all modalities with keystroke biometric sequences." },
                { num: "04", title: "Synthesize", desc: "HuatuoGPT-o1 issues a clinical-grade summary with risk band and confidence." },
              ].map(({ num, title, desc }, i) => (
                <Reveal key={num} delay={i * 130}>
                  <div style={{
                    background: "#fff", borderRadius: 20, border: "1px solid #E5E7EB",
                    padding: "36px 28px",
                    transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, background: "#0A1628",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, color: "#fff", fontSize: "0.9rem", fontFamily: "monospace",
                      marginBottom: 24, letterSpacing: "0.04em",
                    }}>{num}</div>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", marginBottom: 10, fontSize: "1.05rem" }}>{title}</h3>
                    <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <Reveal>
        <section style={{ padding: "80px 48px" }}>
          <div style={{
            maxWidth: 900, margin: "0 auto",
            background: "linear-gradient(135deg, #0F4C5C 0%, #1a6b7e 100%)",
            borderRadius: 28, padding: "64px 80px",
            textAlign: "center",
            boxShadow: "0 24px 80px rgba(15,76,92,0.2)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 20 }}>Next Step</p>
              <h2 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: 16 }}>
                Run All 5 Pillars Together
              </h2>
              <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 36, fontSize: "1rem" }}>
                The unified Daily Checkup completes Mental, Cardiovascular, Blood, Neuro, and LLM synthesis in one 2-minute session.
              </p>
              <Link href="/daily-checkup" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "16px 36px",
                background: "#fff",
                color: "#0F4C5C",
                textDecoration: "none",
                borderRadius: 99,
                fontWeight: 700, fontSize: "1rem",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                transition: "transform 0.25s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
              >
                Begin Full Checkup <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulse { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.08); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
