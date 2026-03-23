"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import RiskBadge from "./components/RiskBadge";
import MetricCard from "./components/MetricCard";

type HealthResponse = Record<string, { ok: boolean; message: string }>;

type WorkflowResponse = {
  patient_id?: string;
  depression?: {
    risk_band?: string;
    confidence?: number;
    depression_score?: number;
    error_message?: string | null;
  };
  ppg?: {
    risk_band?: string;
    map?: number;
    change_map?: number;
    ratio_map?: number;
    confidence?: number;
  };
  kineticare?: {
    risk_band?: string;
    session_quality?: string;
    confidence?: number;
  };
  orchestrator?: {
    overall_risk?: string;
    summary?: string;
    llm_response?: string;
    model_used?: string;
    next_actions?: string[];
    quality_caveat?: string | null;
  };
  error?: string;
};

const PILLARS = [
  {
    href: "/pillar-depression",
    icon: "🧠",
    title: "Digital Phenotype",
    subtitle: "Psychiatric Neuromarkers",
    description: "Multi-modal sentiment, facial micro-expressions, and vocal tremor analysis processed directly via clinical LSTM nets.",
    accent: "#0d9488", // Teal
    tagBg: "#ccfbf1",
    tagColor: "#0f766e",
    tagBorder: "#99f6e4",
    tag: "Modality I",
  },
  {
    href: "/pillar-ppg",
    icon: "💓",
    title: "Optical Vitals",
    subtitle: "Cardiovascular Telemetry",
    description: "Contactless Photoplethysmography (PPG) estimating exact Mean Arterial Pressure changes via hybrid CNN-GRU models.",
    accent: "#0284c7", // Blue
    tagBg: "#e0f2fe",
    tagColor: "#0369a1",
    tagBorder: "#bae6fd",
    tag: "Modality II",
  },
  {
    href: "/pillar-kineticare",
    icon: "⚡",
    title: "KinetiCare",
    subtitle: "Neuromotor Diagnostics",
    description: "Invisible background telemetry analyzing fine-motor impairment indicators through device interactions and IMU sensing.",
    accent: "#7c3aed", // Purple
    tagBg: "#ede9fe",
    tagColor: "#6d28d9",
    tagBorder: "#ddd6fe",
    tag: "Modality III",
  },
];

const SERVICE_KEYS = ["web", "depression", "ppg", "orchestrator", "kineticare"] as const;

export default function Page() {
  const [patientId, setPatientId] = useState("PT-" + Math.floor(Math.random() * 90000 + 10000));
  const [journalText, setJournalText] = useState("I've been feeling fatigued lately and my sleep schedule is very erratic.");
  const [baselineMap, setBaselineMap] = useState("90");
  const [activeTab, setActiveTab] = useState<"dashboard" | "intake">("dashboard");

  const [busyHealth, setBusyHealth] = useState(false);
  const [busyRun, setBusyRun] = useState(false);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [runData, setRunData] = useState<WorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceStatus = useMemo(() => {
    if (!healthData) return {};
    return Object.fromEntries(
      Object.entries(healthData).map(([k, v]) => [k, v.ok ? "ok" : "down"])
    ) as Record<string, "ok" | "down" | "unchecked">;
  }, [healthData]);

  async function checkHealth() {
    setBusyHealth(true);
    setError(null);
    try {
      const res = await fetch("/api/health-all");
      setHealthData((await res.json()) as HealthResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Infrastructure verification failed");
    } finally {
      setBusyHealth(false);
    }
  }

  async function runWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setBusyRun(true);
    setError(null);
    try {
      const res = await fetch("/api/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          journalText, 
          baselineMap: Number(baselineMap), 
          useCamera: true, 
          simulateSpoof: false 
        }),
      });
      const json = (await res.json()) as WorkflowResponse;
      setRunData(json);
      if (json.error) setError(json.error);
      else setActiveTab("dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clinical workflow initiation failed");
    } finally {
      setBusyRun(false);
    }
  }

  const overallRisk = runData?.orchestrator?.overall_risk;
  const allHealthy = healthData && Object.values(healthData).every((v) => v.ok);

  return (
    <div style={{ background: "var(--bg-gradient)", minHeight: "100vh" }}>
      <Navbar serviceStatus={serviceStatus} />
      
      {/* Decorative Background Elements */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "800px", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: "50%", height: "60%", background: "radial-gradient(circle, rgba(13,148,136,0.08) 0%, rgba(255,255,255,0) 70%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: "20%", right: "-10%", width: "60%", height: "80%", background: "radial-gradient(circle, rgba(2,132,199,0.06) 0%, rgba(255,255,255,0) 70%)", borderRadius: "50%" }} />
      </div>

      <main className="container" style={{ padding: "60px 20px 100px", position: "relative", zIndex: 1 }}>

        {/* Hero */}
        <section className="animate-slide-up" style={{ marginBottom: 64, textAlign: "center", maxWidth: 900, margin: "0 auto 64px" }}>
          <div className="tag" style={{ margin: "0 auto 24px", padding: "6px 16px", fontSize: "0.85rem", background: "#f8fafc", borderColor: "#e2e8f0", color: "#64748b" }}>
            <span style={{ color: "var(--accent-teal)" }}>✦</span> Aura Health Clinical Intelligence
          </div>
          <h1 style={{ marginBottom: 24, fontSize: "clamp(3rem, 6vw, 4.5rem)" }}>
            A New Standard for <br />
            <span style={{ color: "var(--accent-teal)" }}>Diagnostic Precision</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.25rem", lineHeight: 1.6, marginBottom: 40, maxWidth: 700, margin: "0 auto 40px" }}>
            Unifying multi-modal AI spanning psychological phenotyping, remote cardiovascular telemetry, and neuromotor tracking into one seamless clinical interface.
          </p>

          {/* CTA controls */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
            <button className="btn btn-primary" onClick={() => setActiveTab("intake")}>
              Begin Patient Intake
            </button>
            <button className="btn btn-secondary" onClick={() => void checkHealth()} disabled={busyHealth}>
              {busyHealth ? <><span className="spinner spinner-dark" /> Verifying Systems...</> : "Verify Infrastructure"}
            </button>
          </div>

          {allHealthy && (
            <div style={{ color: "var(--accent-teal)", fontSize: "0.9rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span className="status-dot status-dot-ok" /> Infrastructure Online & Secure
            </div>
          )}
        </section>

        {/* Tab content area */}
        {activeTab === "intake" ? (
          <section className="animate-slide-up" style={{ maxWidth: 720, margin: "0 auto 64px" }}>
            <div className="glass-card" style={{ padding: 40 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                <div>
                  <h2 style={{ marginBottom: 8 }}>Clinical Intake Form</h2>
                  <p className="text-muted">Enter foundational metrics to contextualize the ML inference pipelines.</p>
                </div>
                <button className="btn" style={{ background: "transparent", color: "var(--text-muted)", padding: 0 }} onClick={() => setActiveTab("dashboard")}>✕</button>
              </div>

              {error && (
                <div className="disclaimer" style={{ marginBottom: 32 }}>
                  <span className="disclaimer-icon">⚠</span> 
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={runWorkflow} className="flex-col gap-6">
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Patient Identifier</div>
                  <input
                    className="input-premium"
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Clinical Notes / Patient Journal</div>
                  <textarea
                    className="input-premium"
                    value={journalText}
                    onChange={(e) => setJournalText(e.target.value)}
                    placeholder="E.g., Patient reports lethargy, anxiety over past 2 weeks..."
                    required
                  />
                  <p className="text-xs text-muted" style={{ marginTop: 8 }}>The text is analyzed strictly by the Digital Phenotype LSTM model.</p>
                </div>

                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Calibrated Baseline MAP (mmHg)</div>
                  <input
                    className="input-premium"
                    type="number"
                    value={baselineMap}
                    onChange={(e) => setBaselineMap(e.target.value)}
                    min={40} max={200}
                    required
                  />
                  <p className="text-xs text-muted" style={{ marginTop: 8 }}>Used as anchor for remote photoplethysmography estimations.</p>
                </div>

                <div className="divider" style={{ margin: "24px 0" }} />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 16 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveTab("dashboard")}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={busyRun}>
                    {busyRun ? <><span className="spinner" /> Analyzing...</> : "Execute Full Diagnostic Suite"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : (
          <>
            {/* Diagnostic Results (if available) */}
            {runData && (
              <section className="animate-slide-up" style={{ marginBottom: 64 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                  <h2 style={{ margin: 0 }}>Clinical Synthesis Report</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div className="text-muted font-medium">Patient: {patientId}</div>
                    {overallRisk && <RiskBadge risk={overallRisk} size="md" label="Aggregate Risk" />}
                  </div>
                </div>

                {/* Pillar metric cards */}
                <div className="grid-3" style={{ marginBottom: 24 }}>
                  <MetricCard
                    icon="🧠"
                    label="Psychiatric Index"
                    value={runData.depression?.depression_score !== undefined ? runData.depression.depression_score.toFixed(3) : "—"}
                    subtext={runData.depression?.error_message ? "Pipeline Error" : `Phenotype Risk: ${runData.depression?.risk_band ?? "N/A"}`}
                    accent={runData.depression?.risk_band === "high" ? "var(--risk-high)" : runData.depression?.risk_band === "medium" ? "var(--risk-medium)" : "var(--accent-teal)"}
                  />
                  <MetricCard
                    icon="💓"
                    label="Cardiovascular MAP"
                    value={runData.ppg?.map !== undefined ? runData.ppg.map.toFixed(1) : "—"}
                    unit="mmHg"
                    subtext={runData.ppg?.risk_band ? `Vascular Risk: ${runData.ppg.risk_band}` : "N/A"}
                    accent="var(--accent-blue)"
                    trend={runData.ppg?.change_map !== undefined ? (runData.ppg.change_map > 5 ? "up" : runData.ppg.change_map < -5 ? "down" : "stable") : null}
                  />
                  <MetricCard
                    icon="⚡"
                    label="Neuromotor Status"
                    value={runData.kineticare?.risk_band ?? "—"}
                    subtext={`Telemetry Quality: ${runData.kineticare?.session_quality ?? "N/A"}`}
                    accent="var(--accent-purple)"
                  />
                </div>

                {/* Orchestrator AI Report */}
                {runData.orchestrator?.summary && (
                  <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div className="label">🤖 Medical Reasoning Engine</div>
                      <span className="tag" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}>{runData.orchestrator.model_used}</span>
                    </div>
                    <p style={{ lineHeight: 1.8, color: "var(--text-primary)", fontSize: "1.1rem", fontWeight: 500, marginBottom: 24 }}>
                      {runData.orchestrator.summary}
                    </p>

                    {runData.orchestrator.llm_response && (
                      <div style={{ background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px" }}>
                        <div className="label" style={{ marginBottom: 12, color: "var(--accent-teal)" }}>Clinical Inference Trace</div>
                        <p style={{ lineHeight: 1.8, color: "var(--text-secondary)", fontSize: "0.95rem", whiteSpace: "pre-wrap" }}>
                          {runData.orchestrator.llm_response}
                        </p>
                      </div>
                    )}

                    {runData.orchestrator.quality_caveat && (
                      <div className="disclaimer" style={{ marginTop: 24 }}>
                        <span className="disclaimer-icon">ℹ</span> {runData.orchestrator.quality_caveat}
                      </div>
                    )}
                  </div>
                )}

                {/* Recommended Protocols */}
                {runData.orchestrator?.next_actions && (
                  <div className="glass-card" style={{ padding: 32 }}>
                    <div className="label" style={{ marginBottom: 20 }}>Recommended Protocols</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {runData.orchestrator.next_actions.map((action, i) => (
                        <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                          <span style={{ color: "var(--accent-teal)", fontWeight: 700, fontSize: "1.1rem", lineHeight: 1 }}>0{i + 1}</span>
                          <span style={{ fontSize: "1rem", color: "var(--text-primary)", fontWeight: 500 }}>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Modules Grid */}
            <section style={{ marginBottom: 64 }}>
              <div className="label" style={{ marginBottom: 24, textAlign: "center" }}>Diagnostic Modalities</div>
              <div className="grid-3">
                {PILLARS.map((p) => (
                  <Link key={p.href} href={p.href} style={{ textDecoration: "none" }}>
                    <div className="glass-card hover-float" style={{ padding: 32, display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: p.tagBg, border: `1px solid ${p.tagBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>
                          {p.icon}
                        </div>
                        <span className="tag" style={{ background: p.tagBg, color: p.tagColor, borderColor: p.tagBorder }}>
                          {p.tag}
                        </span>
                      </div>
                      <h3 style={{ marginBottom: 6, color: "var(--text-primary)" }}>{p.title}</h3>
                      <div className="font-bold text-xs" style={{ color: p.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                        {p.subtitle}
                      </div>
                      <p className="text-sm text-muted" style={{ lineHeight: 1.6, flexGrow: 1 }}>{p.description}</p>
                      
                      <div className="divider" style={{ margin: "20px 0" }} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: p.accent, fontSize: "0.9rem", fontWeight: 600 }}>
                        <span>Explore Modality</span>
                        <span>→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Infrastructure Health */}
            <section>
              <div className="label" style={{ marginBottom: 20 }}>Infrastructure Telemetry</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {SERVICE_KEYS.map((key) => {
                  const status = healthData?.[key];
                  const isOk = status?.ok;
                  const notChecked = !healthData;
                  return (
                    <div key={key} className="glass-card" style={{ padding: "16px 20px" }}>
                      <div className="label" style={{ marginBottom: 8, fontSize: "0.75rem" }}>{key}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`status-dot ${notChecked ? "status-dot-idle" : isOk ? "status-dot-ok" : "status-dot-err"}`} />
                        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: notChecked ? "var(--text-muted)" : isOk ? "var(--risk-low)" : "var(--risk-high)" }}>
                          {notChecked ? "Standby" : isOk ? "Nominal" : "Disrupted"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Footer */}
        <footer style={{ marginTop: 80, textAlign: "center", paddingTop: 40, borderTop: "1px solid var(--border-subtle)" }}>
          <div className="disclaimer" style={{ display: "inline-flex", background: "transparent", border: "1px solid #e2e8f0", color: "#64748b" }}>
            <span className="disclaimer-icon">⚕</span> This system is an investigatory clinical decision support tool. Validation by a licensed physician is strictly required.
          </div>
        </footer>
      </main>
    </div>
  );
}
