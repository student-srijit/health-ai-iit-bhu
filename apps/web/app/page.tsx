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
    modalities_used?: string[];
    status?: string;
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
  blood?: {
    hemoglobin_g_dl?: number;
    risk_band?: string;
    confidence?: number;
    roi_quality?: number;
    warnings?: string[];
  };
  nervous?: {
    risk_band?: string;
    session_quality?: string;
    confidence?: number;
    tap_rate_hz?: number;
    tremor_hz?: number;
    amplitude_dropoff?: number;
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
    subtitle: "Mental Health",
    description: "30-second journal recording analyzed via audio tremors, facial micro-expressions, and NLP sentiment. LSTM + highway layer fusion.",
    accent: "#14b8a6",
    tagBg: "rgba(20,184,166,0.12)",
    tagColor: "#14b8a6",
    tagBorder: "rgba(20,184,166,0.2)",
    tag: "Pillar 1",
  },
  {
    href: "/pillar-ppg",
    icon: "💓",
    title: "Non-Invasive PPG",
    subtitle: "Cardiovascular",
    description: "Photoplethysmography from your phone camera. No cuff needed. Estimates MAP changes and cardiovascular risk via hybrid CNN-GRU.",
    accent: "#f472b6",
    tagBg: "rgba(244,114,182,0.12)",
    tagColor: "#f472b6",
    tagBorder: "rgba(244,114,182,0.2)",
    tag: "Pillar 2",
  },
  {
    href: "/pillar-blood",
    icon: "🩸",
    title: "Conjunctiva Hb",
    subtitle: "Blood Health",
    description: "Inner-eyelid image analysis estimates hemoglobin and anemia-risk band with ROI quality confidence checks.",
    accent: "#ef4444",
    tagBg: "rgba(239,68,68,0.12)",
    tagColor: "#ef4444",
    tagBorder: "rgba(239,68,68,0.2)",
    tag: "Pillar 3",
  },
  {
    href: "/pillar-nervous",
    icon: "🖐",
    title: "Neuromotor Signals",
    subtitle: "Nervous System",
    description: "Tap cadence and tremor-derived dynamics estimate nervous-system risk with session-quality scoring.",
    accent: "#0ea5e9",
    tagBg: "rgba(14,165,233,0.12)",
    tagColor: "#0ea5e9",
    tagBorder: "rgba(14,165,233,0.2)",
    tag: "Pillar 4",
  },
  {
    href: "/pillar-orchestrator",
    icon: "🤖",
    title: "HuatuoGPT-o1",
    subtitle: "Medical Brain",
    description: "Specialized medical LLM with self-verification. Fuses all pillar outputs and provides cross-referenced clinical reasoning.",
    accent: "#a78bfa",
    tagBg: "rgba(167,139,250,0.12)",
    tagColor: "#a78bfa",
    tagBorder: "rgba(167,139,250,0.2)",
    tag: "Pillar 5",
  },
];

const SERVICE_KEYS = ["web", "depression", "ppg", "kineticare", "blood", "nervous", "orchestrator"] as const;

export default function Page() {
  const [journalText, setJournalText] = useState("I've been feeling stressed and sleep-deprived this week.");
  const [baselineMap, setBaselineMap] = useState(90);
  const [useCamera, setUseCamera] = useState(false);
  const [simulateSpoof, setSimulateSpoof] = useState(false);

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
      setError(e instanceof Error ? e.message : "Health check failed");
    } finally {
      setBusyHealth(false);
    }
  }

  async function runWorkflow() {
    setBusyRun(true);
    setError(null);
    try {
      const res = await fetch("/api/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalText, baselineMap, useCamera, simulateSpoof }),
      });
      const json = (await res.json()) as WorkflowResponse;
      setRunData(json);
      if (json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workflow failed");
    } finally {
      setBusyRun(false);
    }
  }

  const overallRisk = runData?.orchestrator?.overall_risk;
  const allHealthy = healthData && Object.values(healthData).every((v) => v.ok);

  return (
    <>
      <Navbar serviceStatus={serviceStatus} />
      <main className="container" style={{ padding: "40px 20px 80px" }}>

        {/* Hero */}
        <section className="animate-slide-up" style={{ marginBottom: 48, textAlign: "center" }}>
          <div
            className="tag"
            style={{ margin: "0 auto 16px", display: "inline-flex", fontSize: "0.8rem" }}
          >
            🏥 IIT-BHU Clinical Decision Support Platform
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)", marginBottom: 16 }}>
            Health AI{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #14b8a6, #38bdf8, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              5-Pillar System
            </span>
          </h1>
          <p style={{ color: "#94a3b8", maxWidth: 640, margin: "0 auto 32px", fontSize: "1.1rem", lineHeight: 1.7 }}>
            Mental health phenotyping · Non-invasive PPG · Blood hemoglobin estimate · Nervous telemetry · HuatuoGPT-o1 fusion.<br />
            All powered by pre-trained models. No wearables required.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => void checkHealth()} disabled={busyHealth}>
              {busyHealth ? <><span className="spinner" /> Checking…</> : "🔍 Check All Services"}
            </button>
            <button className="btn btn-secondary" onClick={() => void runWorkflow()} disabled={busyRun}>
              {busyRun ? <><span className="spinner" /> Running…</> : "⚡ Quick Run Workflow"}
            </button>
          </div>

          {allHealthy && (
            <div style={{ marginTop: 12, color: "#22c55e", fontSize: "0.875rem", fontWeight: 600 }}>
              ✅ All {SERVICE_KEYS.length} services are operational
            </div>
          )}
          {error && (
            <div className="disclaimer" style={{ marginTop: 16, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
              ⚠ {error}
            </div>
          )}
        </section>

        {/* 3-Pillar cards */}
        <section style={{ marginBottom: 48 }}>
          <div className="label" style={{ marginBottom: 20, textAlign: "center" }}>Architecture Overview</div>
          <div className="grid-3">
            {PILLARS.map((p) => (
              <Link key={p.href} href={p.href} style={{ textDecoration: "none" }}>
                <div
                  className="glass-card"
                  style={{
                    padding: 28,
                    cursor: "pointer",
                    borderTop: `2px solid ${p.accent}`,
                    height: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: p.tagBg,
                        border: `1px solid ${p.tagBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.5rem",
                      }}
                    >
                      {p.icon}
                    </div>
                    <div>
                      <span
                        className="tag"
                        style={{ background: p.tagBg, color: p.tagColor, borderColor: p.tagBorder, fontSize: "0.7rem" }}
                      >
                        {p.tag}
                      </span>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>{p.subtitle}</div>
                    </div>
                  </div>
                  <h3 style={{ marginBottom: 8, color: p.accent }}>{p.title}</h3>
                  <p className="text-sm text-muted">{p.description}</p>
                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: p.accent,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    Open Module →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Service health grid */}
        <section style={{ marginBottom: 40 }}>
          <div className="label" style={{ marginBottom: 16 }}>Service Status</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {SERVICE_KEYS.map((key) => {
              const status = healthData?.[key];
              const isOk = status?.ok;
              const notChecked = !healthData;
              return (
                <div
                  key={key}
                  className="glass-card"
                  style={{
                    padding: "14px 16px",
                    borderLeft: `3px solid ${notChecked ? "#334155" : isOk ? "#22c55e" : "#ef4444"}`,
                  }}
                >
                  <div className="label" style={{ marginBottom: 4 }}>{key}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      className={`status-dot ${notChecked ? "status-dot-idle" : isOk ? "status-dot-ok" : "status-dot-err"}`}
                    />
                    <span style={{ fontWeight: 700, fontSize: "0.875rem", color: notChecked ? "#475569" : isOk ? "#22c55e" : "#ef4444" }}>
                      {notChecked ? "Unchecked" : isOk ? "Healthy" : "Down"}
                    </span>
                  </div>
                  {status?.message && <div className="text-xs text-muted mt-2">{status.message}</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Quick input */}
        <section style={{ marginBottom: 40 }}>
          <div className="glass-card" style={{ padding: 28 }}>
            <h2 style={{ marginBottom: 20 }}>⚡ Quick Workflow Run</h2>
            <div className="grid-2" style={{ gap: 16, marginBottom: 20 }}>
              <label>
                <div className="label" style={{ marginBottom: 6 }}>Journal Text</div>
                <textarea
                  className="input-dark"
                  rows={3}
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label>
                  <div className="label" style={{ marginBottom: 6 }}>Baseline MAP (mmHg)</div>
                  <input
                    className="input-dark"
                    type="number"
                    value={baselineMap}
                    min={1}
                    onChange={(e) => setBaselineMap(Number(e.target.value))}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={useCamera}
                    onChange={(e) => setUseCamera(e.target.checked)}
                    style={{ accentColor: "#14b8a6", width: 16, height: 16 }}
                  />
                  <span className="text-sm">Include camera metrics</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={simulateSpoof}
                    onChange={(e) => setSimulateSpoof(e.target.checked)}
                    style={{ accentColor: "#ef4444", width: 16, height: 16 }}
                  />
                  <span className="text-sm">Simulate spoof attack (test anti-spoofing)</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        {runData && (
          <section className="animate-slide-up" style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Workflow Results</h2>
              {overallRisk && <RiskBadge risk={overallRisk} size="md" label="Overall" />}
            </div>

            {/* Pillar metric cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
              <MetricCard
                icon="🧠"
                label="Depression Score"
                value={runData.depression?.depression_score?.toFixed(3) ?? "—"}
                subtext={`Risk: ${runData.depression?.risk_band ?? "—"} · Confidence: ${runData.depression?.confidence ? Math.round(runData.depression.confidence * 100) + "%" : "—"}`}
                accent={runData.depression?.risk_band === "high" ? "#ef4444" : runData.depression?.risk_band === "medium" ? "#f59e0b" : "#14b8a6"}
              />
              <MetricCard
                icon="💓"
                label="Estimated MAP"
                value={runData.ppg?.map?.toFixed(1) ?? "—"}
                unit="mmHg"
                subtext={`Risk: ${runData.ppg?.risk_band ?? "—"} · Ratio: ${runData.ppg?.ratio_map?.toFixed(3) ?? "—"}`}
                accent="#f472b6"
                trend={runData.ppg?.change_map !== undefined ? (runData.ppg.change_map > 5 ? "up" : runData.ppg.change_map < -5 ? "down" : "stable") : null}
              />
              <MetricCard
                icon="⚡"
                label="KinetiCare Risk"
                value={runData.kineticare?.risk_band ?? "—"}
                subtext={`Session: ${runData.kineticare?.session_quality ?? "—"}`}
                accent="#a78bfa"
              />
              <MetricCard
                icon="🩸"
                label="Hemoglobin"
                value={runData.blood?.hemoglobin_g_dl?.toFixed(2) ?? "—"}
                unit="g/dL"
                subtext={`Risk: ${runData.blood?.risk_band ?? "—"} · Confidence: ${runData.blood?.confidence ? Math.round(runData.blood.confidence * 100) + "%" : "—"}`}
                accent={runData.blood?.risk_band === "high" ? "#ef4444" : runData.blood?.risk_band === "medium" ? "#f59e0b" : "#14b8a6"}
              />
              <MetricCard
                icon="🖐"
                label="Nervous Risk"
                value={runData.nervous?.risk_band ?? "—"}
                subtext={`Tremor: ${runData.nervous?.tremor_hz?.toFixed(2) ?? "—"} Hz · Tap: ${runData.nervous?.tap_rate_hz?.toFixed(2) ?? "—"} Hz`}
                accent={runData.nervous?.risk_band === "high" ? "#ef4444" : runData.nervous?.risk_band === "medium" ? "#f59e0b" : "#0ea5e9"}
              />
            </div>

            {/* Orchestrator summary */}
            {runData.orchestrator?.summary && (
              <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>🤖 HuatuoGPT-o1 Clinical Synthesis</div>
                <p style={{ lineHeight: 1.7, color: "#cbd5e1", marginBottom: 12 }}>{runData.orchestrator.summary}</p>

                {runData.orchestrator.llm_response && (
                  <>
                    <div className="divider" />
                    <div className="label" style={{ marginBottom: 8 }}>
                      AI Reasoning
                      <span className="tag" style={{ marginLeft: 8, background: runData.orchestrator.model_used?.includes("fallback") ? "rgba(245,158,11,0.12)" : "rgba(167,139,250,0.12)", color: runData.orchestrator.model_used?.includes("fallback") ? "#fbbf24" : "#a78bfa", borderColor: "transparent", fontSize: "0.65rem" }}>
                        {runData.orchestrator.model_used}
                      </span>
                    </div>
                    <p style={{ lineHeight: 1.7, color: "#94a3b8", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                      {runData.orchestrator.llm_response}
                    </p>
                  </>
                )}

                {runData.orchestrator.quality_caveat && (
                  <div className="disclaimer" style={{ marginTop: 12 }}>{runData.orchestrator.quality_caveat}</div>
                )}
              </div>
            )}

            {/* Next actions */}
            {runData.orchestrator?.next_actions && (
              <div className="glass-card" style={{ padding: 24 }}>
                <div className="label" style={{ marginBottom: 12 }}>Recommended Actions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {runData.orchestrator.next_actions.map((action, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: "#14b8a6", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: "0.9rem", color: "#cbd5e1" }}>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Patient info */}
        {runData?.patient_id && (
          <div className="text-xs text-muted" style={{ textAlign: "center" }}>
            Patient Session: {runData.patient_id}
          </div>
        )}

        {/* Footer disclaimer */}
        <div className="disclaimer" style={{ marginTop: 40, textAlign: "center" }}>
          ⚕ This system is a <strong>clinical decision support tool</strong>, not a diagnostic device. All outputs must be validated by a licensed medical professional.
        </div>
      </main>
    </>
  );
}
