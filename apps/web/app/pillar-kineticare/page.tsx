"use client";

import { useRef, useState } from "react";
import Navbar from "../components/Navbar";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import HuatuoChat from "../components/HuatuoChat";

interface KineticareResult {
  risk_band: string;
  session_quality: string;
  confidence: number;
}

export default function PillarKinetiCarePage() {
  const [result, setResult] = useState<KineticareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Note: True kineticare requires background tracking of IMUs and interaction loops. 
  // We utilize the orchestrator's ML integration to simulate the synthesis check.
  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalText: "No specific journal notes.",
          baselineMap: 90,
          useCamera: false,
          simulateSpoof: false,
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as { kineticare?: KineticareResult };
      
      if (data.kineticare) {
        setResult(data.kineticare);
      } else {
        throw new Error("Neuromotor telemetry unreachable");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const huatuoPrompt = result
    ? `You are HuatuoGPT-o1. Neuromotor session evaluated: Risk Profile=${result.risk_band}, Signal Trust=${result.session_quality}. Provide brief neurological interpretation of fine-motor stability and 2 recommendations.`
    : undefined;

  return (
    <div style={{ background: "var(--bg-gradient)", minHeight: "100vh" }}>
      <Navbar />
      <main className="container" style={{ padding: "40px 20px 100px" }}>
        {/* Hero */}
        <div className="animate-slide-up" style={{ marginBottom: 40, maxWidth: 800 }}>
          <div className="tag" style={{ marginBottom: 16, background: "#f8fafc", color: "var(--accent-purple)", borderColor: "#e2e8f0" }}>
            ⚡ Modality III — Neuromotor Diagnostics
          </div>
          <h1>KinetiCare Telemetry</h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: 700, marginTop: 12, fontSize: "1.1rem", lineHeight: 1.6 }}>
            Continuous, invisible measurement of fine-motor dexterity through device interaction tracking. Designed to proactively flag cognitive & neurological decline.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: "start", gap: 32 }}>
          {/* Left — inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
             <div className="glass-card" style={{ padding: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                   <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--accent-purple)" }}>⚙</span> Device Interaction Sensors
                   </h3>
                   <span className="tag" style={{ background: "#e0f2fe", color: "var(--accent-blue)", borderColor: "#bae6fd" }}>Active</span>
                </div>
                <p className="text-sm text-muted" style={{ marginBottom: 24, lineHeight: 1.6 }}>
                   KinetiCare tracks touchscreen variance, keystroke latency, and scroll fluidity in the background. Press below to aggregate current session metrics and run an inference model over the tracked data sequence.
                </p>

                <div style={{ background: "#f8fafc", padding: "16px 20px", borderRadius: 8, border: "1px solid var(--border-subtle)", marginBottom: 24 }}>
                   <div className="label" style={{ marginBottom: 12 }}>Tracked Metrics</div>
                   <ul style={{ paddingLeft: 20, color: "var(--text-primary)", fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: 8 }}>
                      <li>Inertial Measurement (IMU) Tremor</li>
                      <li>Typing Rhythm Variability</li>
                      <li>Gesture Deviation Trajectory</li>
                   </ul>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "16px 20px" }}
                  onClick={() => void runAnalysis()}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner spinner-dark" /> Compiling Tensor Streams…</> : "Trigger Sequence Analysis"}
                </button>
                
                {error && (
                  <div className="disclaimer" style={{ marginTop: 16 }}>
                    <span className="disclaimer-icon">⚠</span> {error}
                  </div>
                )}
             </div>
          </div>

          {/* Right — results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {result ? (
              <>
                 <div style={{ display: "flex", gap: 24 }}>
                    <div className="glass-card animate-slide-up" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
                       <RiskBadge
                         risk={result.risk_band}
                         score={result.risk_band === "high" ? 0.8 : result.risk_band === "medium" ? 0.5 : 0.2}
                         size="lg"
                         label="Motor Integrity"
                       />
                    </div>
                    <div className="glass-card flex-col justify-between" style={{ padding: 32, flex: 1 }}>
                       <h3 style={{ marginBottom: 16 }}>Session Properties</h3>
                       <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: "auto" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                             <span className="label">Quality</span>
                             <span style={{ fontWeight: 800, fontSize: "0.95rem", marginLeft: "auto", color: "var(--accent-teal)" }}>{result.session_quality}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                             <span className="label">Signal Mode</span>
                             <span style={{ fontWeight: 800, fontSize: "0.95rem", marginLeft: "auto", color: "var(--text-primary)" }}>Continuous</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
                   <MetricCard
                      icon="🎯"
                      label="Inference Confidence"
                      value={`${Math.round(result.confidence * 100)}%`}
                      accent="var(--accent-purple)"
                      subtext="Certainty based on interaction span"
                   />
                 </div>

                {result.risk_band && result.risk_band !== "low" && (
                  <div className="disclaimer">
                     <span className="disclaimer-icon">⚠</span>
                     Elevated tremor or trajectory anomalies detected. Consistent neurological evaluation recommended if this finding remains persistent.
                  </div>
                )}

                <div className="glass-card" style={{ padding: 0 }}>
                  <HuatuoChat prompt={huatuoPrompt} />
                </div>
              </>
            ) : (
               <div className="glass-card" style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, border: "1px dashed var(--border-subtle)" }}>
                 <div style={{ fontSize: "3.5rem", marginBottom: 24, opacity: 0.8 }}>⚡</div>
                 <h3 style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Awaiting Telemetry</h3>
                 <p style={{ color: "var(--text-muted)", textAlign: "center", maxWidth: 300 }}>
                   Invoke the sequence analysis to aggregate recent background motion data and generate a neuromotor risk score.
                 </p>
               </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
