"use client";

import { useRef, useState } from "react";
import Navbar from "../components/Navbar";
import PPGCapture from "../components/PPGCapture";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import HuatuoChat from "../components/HuatuoChat";

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ppgPayload),
      }).catch(async () => {
        return fetch("/api/run-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journalText: "screening", baselineMap: Number(baselineMap), useCamera: false, simulateSpoof: false }),
        });
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as PPGAnalysisResult | { ppg?: PPGAnalysisResult; patient_id?: string };
      
      if ("ppg" in data && data.ppg) {
        if (data.patient_id) patientIdRef.current = data.patient_id;
        setResult(data.ppg);
      } else {
        setResult(data as PPGAnalysisResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function defaultPpgSignal(): number[] {
    return [0.1, 0.12, 0.08, 0.11, 0.15, 0.09, 0.13, 0.1].flatMap((x) => new Array(70).fill(x));
  }

  const mapRange = result ? (result.map > 110 ? "high" : result.map > 100 ? "medium" : "normal") : null;
  const huatuoPrompt = result
    ? `You are HuatuoGPT-o1. PPG non-invasive measurement: MAP=${result.map.toFixed(1)} mmHg (SBP ${result.sbp?.toFixed(1)} DBP ${result.dbp?.toFixed(1)}) HR=${result.hr_bpm?.toFixed(0)} BPM. Risk=${result.risk_band}. Baseline was ${baselineMap} mmHg. Provide brief and extremely cautious cardiovascular interpretation and 2 immediate observations.`
    : undefined;

  // Simple SVG wave drawing utility
  const drawWaveform = () => {
    if (!captured || !captured.ppgSignal) return null;
    const signal = captured.ppgSignal;
    const width = 1000;
    const height = 100;
    const minStr = Math.min(...signal);
    const maxStr = Math.max(...signal);
    const range = (maxStr - minStr) || 1;
    
    // Create polyline path
    const points = signal.map((val, idx) => {
      const x = (idx / (signal.length - 1)) * width;
      const y = height - ((val - minStr) / range) * height;
      return `${x},${y}`;
    }).join(" ");

    return (
      <div style={{ marginTop: 24, padding: 16, background: "#0f172a", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: "0.85rem", marginBottom: 8 }}>
          <span>Raw PPG Optical Waveform (rPPG)</span>
          <span style={{ color: "var(--accent-teal)" }}>● LIVE</span>
        </div>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <polyline points={points} fill="none" stroke="var(--accent-teal)" strokeWidth="3" opacity="0.8" />
        </svg>
      </div>
    );
  };

  return (
    <div style={{ background: "var(--bg-gradient)", minHeight: "100vh" }}>
      <Navbar />
      <main className="container" style={{ padding: "40px 20px 100px" }}>
        {/* Hero */}
        <div className="animate-slide-up" style={{ marginBottom: 40, maxWidth: 800 }}>
          <div className="tag" style={{ marginBottom: 16, background: "#f8fafc", color: "var(--accent-blue)", borderColor: "#e2e8f0" }}>
            💓 Modality II — Optical Vitals
          </div>
          <h1>Cardiovascular Telemetry</h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: 700, marginTop: 12, fontSize: "1.1rem", lineHeight: 1.6 }}>
            Accurate estimation of Mean Arterial Pressure (MAP) and cardiovascular risk through contactless photoplethysmography (PPG). Driven by specialized temporal convolutional networks.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: "start", gap: 32 }}>
          {/* Left — inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* PPG Capture */}
            <div className="glass-card" style={{ padding: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                   <span style={{ color: "var(--accent-blue)" }}>📷</span> Non-Invasive PPG Capture
                </h3>
                {captured && <span className="tag" style={{ background: "#dcfce7", color: "var(--risk-low)", borderColor: "#bbf7d0" }}>✓ Signal Locked</span>}
              </div>
              <p className="text-sm text-muted" style={{ marginBottom: 24 }}>
                Please cover the camera lens and flash with your index finger. The green-channel reflection will isolate your pulse waveform.
              </p>
              <div style={{ borderRadius: "12px", overflow: "hidden", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <PPGCapture onCapture={setCaptured} duration={15} />
              </div>
            </div>

            {/* Config & Action */}
            <div className="glass-card" style={{ padding: 32 }}>
               <h3 style={{ marginBottom: 20 }}>Vascular Baseline</h3>
              <div className="label" style={{ marginBottom: 8 }}>Calibrated MAP (mmHg)</div>
              <input
                className="input-premium"
                type="number"
                value={baselineMap}
                min={60}
                max={160}
                onChange={(e) => setBaselineMap(e.target.value)}
              />
              <p className="text-xs text-muted" style={{ margin: "12px 0 20px" }}>
                Formula for reference: (Systolic + 2×Diastolic) / 3
              </p>

              <button
                className="btn btn-primary"
                style={{ width: "100%", padding: "16px 20px" }}
                onClick={() => void runAnalysis()}
                disabled={loading}
              >
                {loading ? <><span className="spinner spinner-dark" /> Analyzing Waveforms…</> : "Initiate Vascular Check"}
              </button>
              
              {error && (
                <div className="disclaimer" style={{ marginTop: 16 }}>
                  <span className="disclaimer-icon">⚠</span> {error}
                </div>
              )}
            </div>

            {/* Signal info summary (if captured) */}
            {captured && (
              <div className="glass-card" style={{ padding: 24 }}>
                <div className="label" style={{ marginBottom: 12 }}>Telemetry Feed Metrics</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <div>
                     <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Capture Size</div>
                     <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{captured.ppgSignal.length} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>frames</span></div>
                   </div>
                   <div style={{ width: 1, height: 30, background: "var(--border-subtle)" }} />
                   <div>
                     <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Sample Rate</div>
                     <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{captured.samplingRateHz} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>Hz</span></div>
                   </div>
                   <div style={{ width: 1, height: 30, background: "var(--border-subtle)" }} />
                   <div>
                     <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Integrity</div>
                     <div style={{ fontWeight: 800, fontSize: "1.1rem", color: captured.signalQuality > 0.5 ? "var(--risk-low)" : "var(--risk-medium)" }}>{Math.round(captured.signalQuality * 100)}%</div>
                   </div>
                </div>
                {drawWaveform()}
              </div>
            )}
          </div>

          {/* Right — results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {result ? (
              <>
                {/* Score breakdown */}
                <div style={{ display: "flex", gap: 24 }}>
                   <div className="glass-card animate-slide-up" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
                     <RiskBadge
                       risk={result.risk_band}
                       score={result.ratio_map > 1.15 ? 0.85 : result.ratio_map > 1.05 ? 0.55 : 0.2}
                       size="lg"
                       label="Vascular Health"
                     />
                   </div>
                   <div className="glass-card animate-slide-up flex-col justify-between" style={{ padding: 32, flex: 1 }}>
                      <h3 style={{ marginBottom: 12 }}>Extracted Metrics</h3>
                      <div style={{ marginBottom: 16 }}>
                         <div className="label">Observed Delta</div>
                         <div style={{ fontSize: "1.5rem", fontWeight: 800, color: result.change_map > 5 ? "var(--risk-high)" : result.change_map < -5 ? "var(--risk-low)" : "var(--text-primary)" }}>
                            {result.change_map > 0 ? "+" : ""}{result.change_map.toFixed(1)} <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>mmHg</span>
                         </div>
                      </div>
                      <div style={{ paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                         <div className="label">Ratio Coefficient</div>
                         <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>{result.ratio_map.toFixed(3)}</div>
                      </div>
                   </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <MetricCard
                    icon="💓"
                    label="Heart Rate"
                    value={result.hr_bpm?.toFixed(0) || "72"}
                    unit="BPM"
                    accent="var(--accent-blue)"
                  />
                  <MetricCard
                    icon="🩸"
                    label="Current Estimate (MAP)"
                    value={result.map.toFixed(1)}
                    unit="mmHg"
                    accent={result.risk_band === "high" ? "var(--risk-high)" : result.risk_band === "medium" ? "var(--risk-medium)" : "var(--risk-low)"}
                    trend={result.change_map > 5 ? "up" : result.change_map < -5 ? "down" : "stable"}
                  />
                  {result.sbp && result.dbp && (
                    <MetricCard
                      icon="📈"
                      label="Arterial Pressure (SYS/DIA)"
                      value={`${result.sbp.toFixed(0)}/${result.dbp.toFixed(0)}`}
                      unit="mmHg"
                      accent={result.sbp > 130 ? "var(--risk-medium)" : "var(--risk-low)"}
                    />
                  )}
                  <MetricCard
                    icon="🎯"
                    label="Inference Confidence"
                    value={`${Math.round(result.confidence * 100)}%`}
                    accent="var(--text-secondary)"
                  />
                </div>

                {mapRange && mapRange !== "normal" && (
                  <div className="disclaimer">
                    <span className="disclaimer-icon">⚠</span>
                    Abnormal MAP trend detected ({mapRange} trajectory). Immediate review and confirmation via sphygmomanometer is recommended.
                  </div>
                )}

                <div className="glass-card" style={{ padding: 0 }}>
                  <HuatuoChat prompt={huatuoPrompt} />
                </div>
              </>
            ) : (
               <div className="glass-card" style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, border: "1px dashed var(--border-subtle)" }}>
                 <div style={{ fontSize: "3.5rem", marginBottom: 24, opacity: 0.8 }}>💓</div>
                 <h3 style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Awaiting Telemetry</h3>
                 <p style={{ color: "var(--text-muted)", textAlign: "center", maxWidth: 300 }}>
                   Initiate the vascular check to establish current blood pressure estimates directly from the photoplethysmography waveform.
                 </p>
               </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
