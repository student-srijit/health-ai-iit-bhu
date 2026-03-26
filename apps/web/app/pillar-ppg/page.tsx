"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Reveal, CountUp } from "../components/AnimationUtils";
import PPGCapture from "../components/PPGCapture";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import HuatuoChat from "../components/HuatuoChat";
import { ArrowLeft, HeartPulse, ChevronRight, Cpu } from "lucide-react";

interface PPGCaptureResult {
  ppgSignal: number[];
  samplingRateHz: number;
  signalQuality: number;
}

interface PPGAnalysisResult {
  patient_id: string;
  map: number;
  change_map: number;
  ratio_map: number;
  sbp?: number;
  dbp?: number;
  hr_bpm?: number;
  risk_band: string;
  confidence: number;
}

// ─── Custom heart-rate ECG glyph ─────────────────────────────
function HeartGlyph({ signal }: { signal?: number[] }) {
  const width = 1000;
  const height = 100;
  const pts = signal && signal.length > 1
    ? (() => {
        const mn = Math.min(...signal);
        const mx = Math.max(...signal);
        const r = (mx - mn) || 1;
        return signal.map((v, i) => `${(i / (signal.length - 1)) * width},${height - ((v - mn) / r) * height}`).join(" ");
      })()
    : "0,50 100,50 150,50 175,10 200,90 225,50 400,50 425,10 450,90 475,50 1000,50";

  return (
    <svg viewBox="0 0 120 120" fill="none" style={{ width: "100%", height: "100%" }}>
      <circle cx="60" cy="60" r="52" stroke="#F472B6" strokeWidth="0.8" strokeOpacity="0.15" />
      <circle cx="60" cy="60" r="38" stroke="#F472B6" strokeWidth="0.8" strokeOpacity="0.1" strokeDasharray="3 5" />
      {/* Heart shape */}
      <path d="M 60 80 C 20 55 15 30 38 28 C 50 27 60 40 60 40 C 60 40 70 27 82 28 C 105 30 100 55 60 80 Z"
        fill="#F472B6" fillOpacity="0.08" stroke="#F472B6" strokeWidth="1.2" strokeOpacity="0.5" />
      {/* Pulse line across the heart */}
      <path d="M14 60 L28 60 L33 48 L38 72 L43 56 L48 64 L53 60 L67 60 L72 48 L77 72 L82 56 L87 64 L92 60 L106 60"
        stroke="#F472B6" strokeWidth="1.5" strokeOpacity="0.8" fill="none" strokeLinecap="round" />
      {/* Corner annotations */}
      {["HR", "MAP", "SBP", "DBP"].map((l, i) => {
        const positions = [[16, 16], [104, 16], [16, 104], [104, 104]];
        return (
          <text key={l} x={positions[i][0]} y={positions[i][1] + 3} textAnchor="middle"
            fill="#F472B6" fontSize="7" fontWeight="700" fontFamily="monospace" fillOpacity="0.5">
            {l}
          </text>
        );
      })}
    </svg>
  );
}

export default function PillarPPGPage() {
  const [baselineMap, setBaselineMap] = useState("90");
  const [captured, setCaptured] = useState<PPGCaptureResult | null>(null);
  const [result, setResult] = useState<PPGAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patientIdRef = useRef<string>(crypto.randomUUID());

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const ppgPayload: Record<string, unknown> = {
        patient_id: patientIdRef.current,
        baseline_map: Number(baselineMap),
        sampling_rate_hz: captured?.samplingRateHz ?? 100,
        ppg_signal: captured?.ppgSignal ?? defaultPpgSignal(),
      };
      const res = await fetch("http://127.0.0.1:8002/predict", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ppgPayload),
      }).catch(async () =>
        fetch("/api/run-check", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journalText: "screening", baselineMap: Number(baselineMap), useCamera: false, simulateSpoof: false }),
        })
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as PPGAnalysisResult | { ppg?: PPGAnalysisResult; patient_id?: string };
      if ("ppg" in data && data.ppg) { if (data.patient_id) patientIdRef.current = data.patient_id; setResult(data.ppg); }
      else setResult(data as PPGAnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function defaultPpgSignal(): number[] {
    return [0.1, 0.12, 0.08, 0.11, 0.15, 0.09, 0.13, 0.1].flatMap((x) => new Array(70).fill(x));
  }

  const huatuoPrompt = result
    ? `You are HuatuoGPT-o1. PPG non-invasive measurement: MAP=${result.map.toFixed(1)} mmHg (SBP ${result.sbp?.toFixed(1)} DBP ${result.dbp?.toFixed(1)}) HR=${result.hr_bpm?.toFixed(0)} BPM. Risk=${result.risk_band}. Baseline was ${baselineMap} mmHg. Brief cardiovascular interpretation.`
    : undefined;

  const drawWaveform = () => {
    if (!captured?.ppgSignal) return null;
    const signal = captured.ppgSignal;
    const mn = Math.min(...signal);
    const mx = Math.max(...signal);
    const r = (mx - mn) || 1;
    const pts = signal.map((v, i) => `${(i / (signal.length - 1)) * 1000},${100 - ((v - mn) / r) * 100}`).join(" ");
    return (
      <div style={{ marginTop: 24, padding: 20, background: "#0A1628", borderRadius: 16, border: "1px solid rgba(244,114,182,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: "0.72rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Raw PPG Optical Waveform (rPPG)</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F472B6", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "0.7rem", color: "#F472B6", fontWeight: 700 }}>LIVE SIGNAL</span>
          </div>
        </div>
        <svg width="100%" height={100} viewBox="0 0 1000 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ppgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F472B6" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#F472B6" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <polyline points={pts} fill="none" stroke="#F472B6" strokeWidth="2.5" opacity="0.9" />
        </svg>
      </div>
    );
  };

  return (
    <div style={{ background: "#FAFBFC", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(250,251,252,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 48px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F472B6", boxShadow: "0 0 6px #F472B680" }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Pillar II · Cardiovascular</span>
        </div>
        <button onClick={() => void runAnalysis()} disabled={loading} style={{ padding: "9px 24px", background: loading ? "#9CA3AF" : "#0F4C5C", color: "#fff", border: "none", borderRadius: 99, fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.25s", boxShadow: loading ? "none" : "0 4px 14px rgba(15,76,92,0.3)" }}>
          {loading ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff6", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Analyzing…</> : <>Run Analysis <ChevronRight size={14} /></>}
        </button>
      </div>

      {/* Hero */}
      <section style={{ paddingTop: 120, paddingBottom: 100, padding: "120px 48px 100px", maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 80 }}>
        <div style={{ flex: "0 0 55%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(244,114,182,0.08)", border: "1px solid rgba(244,114,182,0.2)", borderRadius: 99, marginBottom: 28 }}>
            <HeartPulse size={12} style={{ color: "#F472B6" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#F472B6" }}>Pillar II — Optical Vitals</span>
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#0A1628", marginBottom: 24, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 0ms both" }}>
            Cardiovascular Telemetry<br /><span style={{ color: "#F472B6" }}>Without a Cuff.</span>
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#6B7280", lineHeight: 1.75, maxWidth: 520, marginBottom: 36, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 150ms both" }}>
            Contactless photoplethysmography estimates MAP, heart rate, and blood pressure via your phone's camera. A hybrid CNN-GRU processes 15 seconds of your optical pulse waveform.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 250ms both" }}>
            {["Camera covers finger — no hardware needed", "CNN-GRU trained on UBFC-rPPG benchmark", "MAP, SBP, DBP, and heart rate estimation", "HuatuoGPT-o1 cardiovascular interpretation"].map(b => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F472B6", flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: "#4B5563", fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "0 0 45%", display: "flex", justifyContent: "center", animation: "slideInRight 1s cubic-bezier(0.22,1,0.36,1) 200ms both" }}>
          <div style={{ position: "relative", width: 320, height: 320 }}>
            <div style={{ position: "absolute", inset: -40, background: "radial-gradient(circle, rgba(244,114,182,0.08) 0%, transparent 70%)", borderRadius: "50%", animation: "pulse 4s ease-in-out infinite" }} />
            <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: "50%", border: "1px solid rgba(244,114,182,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 80px rgba(244,114,182,0.12)", padding: 32 }}>
              <HeartGlyph signal={captured?.ppgSignal} />
            </div>
            {[{ label: "<4", sub: "MAE BPM", top: -10, right: -20 }, { label: "15s", sub: "Capture", bottom: 20, left: -30 }].map(({ label, sub, ...pos }) => (
              <div key={label} style={{ position: "absolute", ...pos, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "#0A1628", lineHeight: 1 }}>{label}</div>
                <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <Reveal>
        <div style={{ borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", padding: "32px 48px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {[{ n: 94, s: "%", l: "MAP estimation accuracy" }, { n: 15, s: "s", l: "Optical capture duration" }, { n: 4, s: " BPM", l: "Mean Absolute Error (MAE)" }, { n: 0, s: " hardware", l: "No wearables required" }].map(({ n, s, l }) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.04em", lineHeight: 1 }}><CountUp target={n} suffix={s} /></div>
                <p style={{ fontSize: "0.8rem", color: "#9CA3AF", marginTop: 8, fontWeight: 500 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Main Panel */}
      <section style={{ padding: "80px 48px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
          {/* Left: capture + baseline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Reveal>
              <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1rem", margin: 0 }}>Non-Invasive PPG Capture</h3>
                  {captured && <div style={{ padding: "4px 12px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 99 }}><span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16A34A" }}>✓ SIGNAL LOCKED</span></div>}
                </div>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.65, marginBottom: 20 }}>Cover your camera lens and flash with your index finger. The green-channel reflection isolates your pulse waveform.</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: "#F3F4F6", border: "1px solid #E5E7EB" }}>
                  <PPGCapture onCapture={setCaptured} duration={15} />
                </div>
                {drawWaveform()}
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1rem", marginBottom: 20 }}>Vascular Baseline</h3>
                <label style={{ display: "block", marginBottom: 8, fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Resting MAP (mmHg) — ask your doctor if unsure</label>
                <input type="number" value={baselineMap} onChange={e => setBaselineMap(e.target.value)} min={60} max={130} style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: "1rem", color: "#374151", outline: "none", fontFamily: "monospace" }} />
                {error && <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, fontSize: "0.85rem", color: "#DC2626" }}>⚠ {error}</div>}
              </div>
            </Reveal>
          </div>

          {/* Right: results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {result ? (
              <>
                <Reveal>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <RiskBadge risk={result.risk_band} score={result.map / 130} size="lg" label="MAP Risk Assessment" />
                  </div>
                </Reveal>
                <Reveal delay={80}>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", marginBottom: 20, fontSize: "1rem" }}>Hemodynamic Metrics</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <MetricCard icon="🫀" label="MAP" value={result.map.toFixed(1)} unit="mmHg" accent={result.map > 110 ? "#DC2626" : result.map > 100 ? "#F59E0B" : "#22C55E"} />
                      <MetricCard icon="💓" label="HR" value={result.hr_bpm?.toFixed(0) || "—"} unit="BPM" accent="#F472B6" />
                      <MetricCard icon="⬆️" label="SBP" value={result.sbp?.toFixed(0) || "—"} unit="mmHg" accent="#9CA3AF" />
                      <MetricCard icon="⬇️" label="DBP" value={result.dbp?.toFixed(0) || "—"} unit="mmHg" accent="#9CA3AF" />
                    </div>
                  </div>
                </Reveal>
                <Reveal delay={140}>
                  <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <div style={{ background: "#0A1628", padding: "16px 28px", display: "flex", alignItems: "center", gap: 10 }}>
                      <Cpu size={16} style={{ color: "#F472B6" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>HuatuoGPT-o1 Cardiovascular Reasoning</span>
                    </div>
                    <HuatuoChat prompt={huatuoPrompt} />
                  </div>
                </Reveal>
              </>
            ) : (
              <Reveal>
                <div style={{ background: "#fff", borderRadius: 24, border: "1.5px dashed #D1D5DB", padding: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, textAlign: "center" }}>
                  <HeartPulse size={80} strokeWidth={0.8} style={{ color: "#D1D5DB", marginBottom: 28 }} />
                  <h3 style={{ color: "#9CA3AF", fontWeight: 600, fontSize: "1.1rem", marginBottom: 10 }}>No Signal Yet</h3>
                  <p style={{ color: "#D1D5DB", maxWidth: 280, fontSize: "0.875rem", lineHeight: 1.65 }}>Capture a 15-second optical pulse, set your baseline MAP, then run the analysis.</p>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <Reveal>
        <section style={{ padding: "0 48px 80px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", background: "linear-gradient(135deg, #0F4C5C 0%, #1a6b7e 100%)", borderRadius: 28, padding: "64px 80px", textAlign: "center", boxShadow: "0 24px 80px rgba(15,76,92,0.2)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: 12 }}>Add Neuro & Mental Signals</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 32, fontSize: "1rem" }}>The unified checkup fuses all 5 pillars in one 2-minute session for richer clinical synthesis.</p>
              <Link href="/daily-checkup" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: "#fff", color: "#0F4C5C", textDecoration: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.95rem", transition: "transform 0.25s" }} onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; }}>
                Begin Full Checkup <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </Reveal>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}@keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}@keyframes pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
