"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import HuatuoChat from "../components/HuatuoChat";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";

interface WorkflowResult {
  patient_id: string;
  depression?: { depression_score: number; risk_band: string; confidence: number; modalities_used: string[] };
  ppg?: { map: number; change_map: number; ratio_map: number; risk_band: string };
  kineticare?: { risk_band: string; session_quality: string };
  orchestrator?: {
    overall_risk: string;
    summary: string;
    huatuo_prompt: string;
    llm_response: string;
    model_used: string;
    next_actions: string[];
    quality_caveat?: string | null;
  };
}

export default function PillarOrchestratorPage() {
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalText, setJournalText] = useState("I have been feeling under pressure with work and sleep has been disturbed.");
  const [baselineMap, setBaselineMap] = useState("90");

  async function runWorkflow() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalText, baselineMap: Number(baselineMap), useCamera: false, simulateSpoof: false }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as WorkflowResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workflow failed");
    } finally {
      setLoading(false);
    }
  }

  const orch = result?.orchestrator;
  const overallRisk = orch?.overall_risk;

  return (
    <div style={{ background: "var(--bg-gradient)", minHeight: "100vh" }}>
      <Navbar />
      <main className="container" style={{ padding: "40px 20px 80px" }}>
        {/* Hero */}
        <div className="animate-slide-up" style={{ marginBottom: 40, maxWidth: 800 }}>
          <div className="tag" style={{ marginBottom: 16, background: "#f8fafc", color: "var(--accent-purple)", borderColor: "#e2e8f0" }}>
            🤖 Modality III — Clinical AI Core
          </div>
          <h1 style={{ color: "var(--text-primary)" }}>Medical Reasoning Engine</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: "1.1rem", lineHeight: 1.6 }}>
            An autonomous clinical agent that probabilistically fuses all 3 diagnostic modalities — phenotypic depression score, cardiovascular map variations, and neuromotor metrics — to provide robust, cross-referenced inferences.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 380px) 1fr", gap: 32, alignItems: "start" }}>
          {/* Left — input panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="glass-card" style={{ padding: 32 }}>
              <h3 style={{ marginBottom: 20 }}>Clinical Telemetry Input</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <label>
                  <div className="label" style={{ marginBottom: 8 }}>Psychiatric History / Notes</div>
                  <textarea
                    className="input-premium"
                    rows={4}
                    value={journalText}
                    onChange={(e) => setJournalText(e.target.value)}
                  />
                </label>
                <label>
                  <div className="label" style={{ marginBottom: 8 }}>Vascular Anchor (MAP mmHg)</div>
                  <input
                    className="input-premium"
                    type="number"
                    value={baselineMap}
                    min={60}
                    max={160}
                    onChange={(e) => setBaselineMap(e.target.value)}
                  />
                </label>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 8 }}
                  onClick={() => void runWorkflow()}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner spinner-dark" /> Synthesizing Data…</> : "Initialize Full Workflow"}
                </button>
                {error && <div className="disclaimer" style={{ marginTop: 8 }}><span className="disclaimer-icon">⚠</span> {error}</div>}
              </div>
            </div>

            {/* Pillar status cards */}
            {result && (
              <>
                <div className="glass-card" style={{ padding: 24 }}>
                  <div className="label" style={{ marginBottom: 16 }}>Raw Modality Feeds</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { label: "Depression Phenotype", risk: result.depression?.risk_band, value: result.depression?.depression_score?.toFixed(3) },
                      { label: "Cardiovascular Trend", risk: result.ppg?.risk_band, value: `${result.ppg?.map?.toFixed(1)} mmHg` },
                      { label: "Neuromotor Output", risk: result.kineticare?.risk_band, value: result.kineticare?.session_quality },
                    ].map((p) => (
                      <div key={p.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
                        <span style={{ fontSize: "0.95rem", fontWeight: 500 }}>{p.label}</span>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>{p.value}</span>
                          <span className={`risk-badge risk-badge-${p.risk}`} style={{ fontSize: "0.75rem", padding: "4px 10px" }}>{p.risk}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  <RiskBadge risk={overallRisk} size="lg" label="Calculated Risk Group" />
                  <div className="text-sm text-muted font-bold" style={{ textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase" }}>SESSION: {result.patient_id}</div>
                </div>
              </>
            )}
          </div>

          {/* Right — orchestrator output */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {orch && (
              <div className="glass-card animate-slide-up" style={{ padding: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                   <div className="label">Orchestrator Clinical Summary</div>
                   <div className="tag" style={{ background: "#f8fafc", color: "var(--text-muted)", borderColor: "#e2e8f0" }}>Auto-Generated</div>
                </div>
                <p style={{ lineHeight: 1.8, color: "var(--text-primary)", fontSize: "1.1rem", fontWeight: 500 }}>{orch.summary}</p>
                {orch.quality_caveat && <div className="disclaimer" style={{ marginTop: 20 }}><span className="disclaimer-icon">ℹ</span> {orch.quality_caveat}</div>}
              </div>
            )}

            {orch?.next_actions && (
              <div className="glass-card animate-slide-up" style={{ padding: 40 }}>
                <div className="label" style={{ marginBottom: 20 }}>Recommended Interventions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {orch.next_actions.map((action, i) => (
                    <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", background: "#f8fafc", padding: "16px 20px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      <div style={{ color: "var(--accent-purple)", fontWeight: 800, fontSize: "1.1rem" }}>{`0${i + 1}`}</div>
                      <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.6, color: "var(--text-primary)", fontWeight: 500 }}>{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HuatuoGPT reasoning */}
            <div className="glass-card" style={{ padding: 0 }}>
              <HuatuoChat
                prompt={orch?.huatuo_prompt}
                llmResponse={orch?.llm_response}
                modelUsed={orch?.model_used}
                summary={orch?.summary}
              />
            </div>
            
            {!result && !loading && (
              <div className="glass-card" style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400, border: "1px dashed var(--border-subtle)" }}>
                <div style={{ fontSize: "3rem", marginBottom: 24 }}>🧠</div>
                <h3 style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Diagnostic Engine Idle</h3>
                <p style={{ color: "var(--text-muted)", textAlign: "center", maxWidth: 300 }}>
                  Enter the necessary telemetry on the left and invoke the workflow to synthesize the multimodal patient record.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
