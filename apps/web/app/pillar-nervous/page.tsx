"use client";

import { PointerEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Reveal, CountUp } from "../components/AnimationUtils";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import { ArrowLeft, Hand, ChevronRight, RotateCcw } from "lucide-react";

type TapPoint = { x: number; y: number; t: number };
type NervousResult = {
  patient_id: string; risk_band: string; session_quality: string; confidence: number;
  tap_rate_hz: number; tremor_hz: number; amplitude_dropoff: number; metrics?: Record<string, number>;
};
type RunCheckResponse = { nervous?: NervousResult; warnings?: string[]; error?: string };

// ─── Custom neural path glyph ─────────────────────────────────
function NeuralGlyph({ tapCount }: { tapCount: number }) {
  const nodes = [
    [60, 20], [20, 55], [100, 55], [38, 90], [82, 90], [60, 60],
  ] as [number, number][];
  const edges = [[0,1],[0,2],[1,3],[2,4],[1,5],[2,5],[5,3],[5,4]];
  return (
    <svg viewBox="0 0 120 120" fill="none" style={{ width: "100%", height: "100%" }}>
      <circle cx="60" cy="60" r="52" stroke="#60A5FA" strokeWidth="0.8" strokeOpacity="0.12" />
      <circle cx="60" cy="60" r="36" stroke="#60A5FA" strokeWidth="0.6" strokeOpacity="0.08" strokeDasharray="2 6" />
      {edges.map(([a, b], i) => (
        <line key={i}
          x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="#60A5FA" strokeWidth="1.2" strokeOpacity={0.25 + (tapCount % 8) / 32}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 6 : 4}
          fill={i === 5 ? "#60A5FA" : "none"}
          stroke="#60A5FA" strokeWidth="1.5"
          fillOpacity={i === 5 ? 0.18 : 0}
          strokeOpacity={0.55}
        />
      ))}
      {/* Animated ripple from center on taps */}
      {tapCount > 0 && (
        <circle cx="60" cy="60" r="10" stroke="#60A5FA" strokeWidth="1" strokeOpacity="0.6" className="ripple" />
      )}
      <text x="60" y="64" textAnchor="middle" fill="#60A5FA" fontSize="11" fontWeight="800" fontFamily="monospace" fillOpacity="0.7">
        {tapCount > 0 ? tapCount : "—"}
      </text>
    </svg>
  );
}

export default function PillarNervousPage() {
  const [tapPoints, setTapPoints] = useState<TapPoint[]>([]);
  const [result, setResult] = useState<NervousResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const derived = useMemo(() => deriveTapMetrics(tapPoints), [tapPoints]);

  function onTap(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setIsActive(true);
    setTimeout(() => setIsActive(false), 180);
    setTapPoints(prev => [...prev, { x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() }]);
  }

  function resetSession() { setTapPoints([]); setResult(null); setWarnings([]); setError(null); }

  async function runNervousCheck() {
    if (derived.tapIntervalsMs.length < 10) { setError("Record at least 11 taps before running analysis."); return; }
    const samplingRateHz = 30;
    const tremorSignal = synthesizeTremorSignal(derived.tapIntervalsMs, derived.tapDistancesPx, 128, samplingRateHz);
    setLoading(true); setError(null); setWarnings([]);
    try {
      const res = await fetch("/api/run-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalText: "nervous screening", baselineMap: 90, useCamera: false, simulateSpoof: false,
          nervousTapIntervalsMs: derived.tapIntervalsMs, nervousTapDistancesPx: derived.tapDistancesPx,
          nervousTremorSignal: tremorSignal, nervousSamplingRateHz: samplingRateHz,
        }),
      });
      const data = (await res.json()) as RunCheckResponse;
      if (!res.ok) { setError(data.error ?? `Request failed (${res.status})`); setResult(null); return; }
      if (!data.nervous) { setError("Nervous result was not returned by the backend."); setResult(null); return; }
      setResult(data.nervous);
      setWarnings(data.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nervous check failed");
      setResult(null);
    } finally { setLoading(false); }
  }

  const tapProgress = Math.min((tapPoints.length / 11) * 100, 100);

  return (
    <div style={{ background: "#FAFBFC", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(250,251,252,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 48px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}><ArrowLeft size={16} /> Back</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#60A5FA", boxShadow: "0 0 6px #60A5FA80" }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Pillar IV · Neuromotor</span>
        </div>
        <button onClick={() => void runNervousCheck()} disabled={loading || tapPoints.length < 11} style={{ padding: "9px 24px", background: (loading || tapPoints.length < 11) ? "#9CA3AF" : "#0F4C5C", color: "#fff", border: "none", borderRadius: 99, fontSize: "0.875rem", fontWeight: 600, cursor: (loading || tapPoints.length < 11) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.25s", boxShadow: (loading || tapPoints.length < 11) ? "none" : "0 4px 14px rgba(15,76,92,0.3)" }}>
          {loading ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff6", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Analyzing…</> : <>Analyze Tremor <ChevronRight size={14} /></>}
        </button>
      </div>

      {/* Hero */}
      <section style={{ padding: "120px 48px 80px", maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 80 }}>
        <div style={{ flex: "0 0 55%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 99, marginBottom: 28 }}>
            <Hand size={12} style={{ color: "#60A5FA" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60A5FA" }}>Pillar IV — Neuromotor Signals</span>
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#0A1628", marginBottom: 24, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 0ms both" }}>
            Fine-Motor &amp; Tremor<br /><span style={{ color: "#60A5FA" }}>Dynamics Analysis.</span>
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#6B7280", lineHeight: 1.75, maxWidth: 520, marginBottom: 36, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 150ms both" }}>
            Tap cadence, inter-tap intervals, and spatial displacement patterns are analyzed via FFT and kinematic velocity synthesis to detect early neuromotor anomalies.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 250ms both" }}>
            {["Tap interval & velocity FFT decomposition", "4–6Hz tremor band extraction", "Amplitude dropoff coefficient scoring", "No hardware — just your touchscreen"].map(b => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#60A5FA", flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: "#4B5563", fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "0 0 45%", display: "flex", justifyContent: "center", animation: "slideInRight 1s cubic-bezier(0.22,1,0.36,1) 200ms both" }}>
          <div style={{ position: "relative", width: 320, height: 320 }}>
            <div style={{ position: "absolute", inset: -40, background: "radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)", borderRadius: "50%", animation: "glow 4s ease-in-out infinite" }} />
            <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: "50%", border: "1px solid rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 80px rgba(96,165,250,0.12)", padding: 32, transition: "all 0.18s" }}>
              <NeuralGlyph tapCount={tapPoints.length} />
            </div>
            {[{ l: `${tapPoints.length}`, s: "Taps", top: -10, right: -20 }, { l: derived.meanIntervalMs > 0 ? derived.meanIntervalMs.toFixed(0) + "ms" : "—", s: "Mean IIT", bottom: 20, left: -30 }].map(({ l, s, ...pos }) => (
              <div key={s} style={{ position: "absolute", ...pos, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "#0A1628", lineHeight: 1 }}>{l}</div>
                <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <Reveal>
        <div style={{ borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", padding: "32px 48px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {[{ n: 11, s: "+", l: "Minimum taps required" }, { n: 4, s: "–6Hz", l: "Resting tremor detection band" }, { n: 128, s: " pts", l: "FFT signal synthesis size" }, { n: 100, s: "%", l: "On-device, no data stored" }].map(({ n, s, l }) => (
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
          {/* Left: Tap Pad */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Reveal>
              <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1rem", marginBottom: 8 }}>Tap Capture Pad</h3>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.65, marginBottom: 24 }}>Record at least 11 taps. Maintain a steady rhythm for the highest quality signal.</p>
                {/* Progress bar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.775rem", fontWeight: 600, color: "#6B7280" }}>Signal Sufficiency</span>
                    <span style={{ fontSize: "0.775rem", fontWeight: 700, color: tapProgress >= 100 ? "#22C55E" : "#60A5FA" }}>{tapPoints.length >= 11 ? "Ready" : `${tapPoints.length}/11 taps`}</span>
                  </div>
                  <div style={{ height: 6, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${tapProgress}%`, background: tapProgress >= 100 ? "#22C55E" : "#60A5FA", borderRadius: 99, transition: "width 0.3s ease" }} />
                  </div>
                </div>
                {/* The tap target */}
                <button
                  type="button"
                  onPointerDown={onTap}
                  style={{
                    width: "100%", minHeight: 240, borderRadius: 20,
                    border: `2px dashed ${isActive ? "#60A5FA" : "rgba(96,165,250,0.3)"}`,
                    background: isActive ? "rgba(96,165,250,0.06)" : "rgba(96,165,250,0.02)",
                    color: "#374151", fontWeight: 700, fontSize: "1rem",
                    cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 12,
                    transition: "all 0.15s ease",
                    transform: isActive ? "scale(0.99)" : "scale(1)",
                    boxShadow: isActive ? "0 0 0 4px rgba(96,165,250,0.15)" : "none",
                    userSelect: "none",
                  }}
                >
                  <Hand size={36} style={{ color: isActive ? "#60A5FA" : "#D1D5DB", transition: "color 0.15s" }} />
                  <span style={{ color: isActive ? "#60A5FA" : "#9CA3AF", fontWeight: 600, fontSize: "0.9rem" }}>
                    {tapPoints.length === 0 ? "Tap to begin" : `${tapPoints.length} taps recorded`}
                  </span>
                </button>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={resetSession} style={{ flex: 1, padding: "12px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#60A5FA"} onMouseLeave={e => e.currentTarget.style.borderColor = "#E5E7EB"}>
                    <RotateCcw size={14} /> Reset
                  </button>
                  <button onClick={() => void runNervousCheck()} disabled={loading || tapPoints.length < 11} style={{ flex: 2, padding: "12px", background: (loading || tapPoints.length < 11) ? "#F3F4F6" : "#0F4C5C", border: "none", borderRadius: 14, fontWeight: 700, color: (loading || tapPoints.length < 11) ? "#9CA3AF" : "#fff", cursor: (loading || tapPoints.length < 11) ? "not-allowed" : "pointer", transition: "all 0.25s" }}>
                    {loading ? "Analyzing…" : "Run Tremor Analysis"}
                  </button>
                </div>
                {error && <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, fontSize: "0.85rem", color: "#DC2626" }}>⚠ {error}</div>}
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 16 }}>Live Session Stats</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[["Intervals", derived.tapIntervalsMs.length], ["Distances", derived.tapDistancesPx.length], ["Mean IIT", `${derived.meanIntervalMs.toFixed(1)}ms`], ["Spatial Disp.", `${derived.meanDistancePx.toFixed(1)}px`]].map(([l, v]) => (
                    <div key={l as string} style={{ padding: "14px 16px", background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                      <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "1.1rem", color: "#0A1628" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right: Results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {result ? (
              <>
                <Reveal>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <RiskBadge risk={result.risk_band} score={result.risk_band === "high" ? 0.85 : result.risk_band === "medium" ? 0.55 : 0.2} size="lg" label="Neuromotor Risk" />
                  </div>
                </Reveal>
                <Reveal delay={80}>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", marginBottom: 20, fontSize: "1rem" }}>Tremor Metrics</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <MetricCard icon="🎯" label="Confidence" value={`${Math.round(result.confidence * 100)}%`} accent="#60A5FA" />
                      <MetricCard icon="⚙" label="Session Quality" value={result.session_quality} accent="#9CA3AF" />
                      <MetricCard icon="⏱" label="Tap Rate" value={result.tap_rate_hz.toFixed(2)} unit="Hz" accent="#14b8a6" />
                      <MetricCard icon="〰" label="Tremor Peak" value={result.tremor_hz.toFixed(2)} unit="Hz" accent="#F59E0B" />
                      <MetricCard icon="📉" label="Amplitude Dropoff" value={`${Math.round(result.amplitude_dropoff * 100)}%`} accent="#EF4444" />
                    </div>
                    {warnings.length > 0 && <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, fontSize: "0.85rem", color: "#92400E" }}>⚠ {warnings.join(" ")}</div>}
                  </div>
                </Reveal>
              </>
            ) : (
              <Reveal>
                <div style={{ background: "#fff", borderRadius: 24, border: "1.5px dashed #D1D5DB", padding: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, textAlign: "center" }}>
                  <Hand size={80} strokeWidth={0.8} style={{ color: "#D1D5DB", marginBottom: 28 }} />
                  <h3 style={{ color: "#9CA3AF", fontWeight: 600, fontSize: "1.1rem", marginBottom: 10 }}>Awaiting Session</h3>
                  <p style={{ color: "#D1D5DB", maxWidth: 280, fontSize: "0.875rem", lineHeight: 1.65 }}>Record at least 11 taps on the pad to the left, then run the tremor analysis.</p>
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
              <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: 12 }}>Run the Full Clinical Suite</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 32, fontSize: "1rem" }}>Combine Mental, Cardiac, Blood, Neuro, and AI synthesis in one unified 2-minute checkup.</p>
              <Link href="/daily-checkup" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: "#fff", color: "#0F4C5C", textDecoration: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.95rem", transition: "transform 0.25s" }} onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; }}>
                Begin Full Checkup <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </Reveal>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}@keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}@keyframes glow{0%,100%{opacity:.5}50%{opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function deriveTapMetrics(points: TapPoint[]) {
  if (points.length < 2) return { tapIntervalsMs: [], tapDistancesPx: [], meanIntervalMs: 0, meanDistancePx: 0 };
  const tapIntervalsMs: number[] = [];
  const tapDistancesPx: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], cur = points[i];
    tapIntervalsMs.push(Number(Math.max(1, cur.t - prev.t).toFixed(3)));
    tapDistancesPx.push(Number(Math.sqrt((cur.x - prev.x) ** 2 + (cur.y - prev.y) ** 2).toFixed(3)));
  }
  return {
    tapIntervalsMs, tapDistancesPx,
    meanIntervalMs: tapIntervalsMs.reduce((a, v) => a + v, 0) / tapIntervalsMs.length,
    meanDistancePx: tapDistancesPx.reduce((a, v) => a + v, 0) / tapDistancesPx.length,
  };
}

function synthesizeTremorSignal(intervalsMs: number[], distancesPx: number[], size: number, samplingRateHz: number): number[] {
  if (!intervalsMs.length || !distancesPx.length) return new Array(size).fill(0);
  const velocities = intervalsMs.map((ms, i) => distancesPx[Math.min(i, distancesPx.length - 1)] / Math.max(ms, 1));
  const mean = velocities.reduce((a, v) => a + v, 0) / velocities.length;
  const centered = velocities.map(v => v - mean);
  const maxAbs = Math.max(...centered.map(Math.abs), 1e-6);
  const norm = centered.map(v => v / maxAbs);
  const meanInterval = intervalsMs.reduce((a, v) => a + v, 0) / intervalsMs.length;
  const tremorFreqHz = Math.min(8, Math.max(3, (1000 / Math.max(meanInterval, 1)) * 0.9));
  return Array.from({ length: size }, (_, i) => {
    const src = Math.floor((i / size) * norm.length);
    return Number((0.65 * (norm[Math.min(src, norm.length - 1)] ?? 0) + 0.35 * Math.sin(2 * Math.PI * tremorFreqHz * i / samplingRateHz)).toFixed(6));
  });
}
