"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Activity, Brain, AlertCircle, Search, ShieldCheck, ArrowLeft, ChevronDown, HeartPulse, Zap, ArrowUpRight } from "lucide-react";

type Assessment = {
  patientId: string;
  createdAt: string;
  depression?: { risk_score?: number; risk_band?: string };
  kineticare?: { neurological_risk_index?: number; risk_band?: string; fatigue_level?: string };
  ppg?: { map?: number; risk_band?: string };
  orchestrator?: { overall_risk_band?: string; summary?: string };
};

function getRiskBand(band?: string): "low" | "medium" | "high" | "unknown" {
  if (!band) return "unknown";
  const b = band.toLowerCase();
  if (b === "low") return "low";
  if (b === "medium" || b === "elevated") return "medium";
  if (b === "high" || b === "critical") return "high";
  return "unknown";
}

function RiskDot({ band }: { band?: string }) {
  const level = getRiskBand(band);
  const colors = { low: "#22C55E", medium: "#F59E0B", high: "#E14B4B", unknown: "#9CA3AF" };
  const color = colors[level];
  return (
    <div style={{ position: "relative", display: "inline-block", width: 10, height: 10, flexShrink: 0 }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        boxShadow: level !== "unknown" ? `0 0 8px ${color}` : "none",
      }} />
      {level === "high" && (
        <motion.div
          style={{
            position: "absolute", inset: -5, borderRadius: "50%",
            border: `1px solid ${color}`,
          }}
          animate={{ scale: [1, 2], opacity: [0.6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
    </div>
  );
}

function RiskPill({ band }: { band?: string }) {
  const level = getRiskBand(band);
  const styles: Record<string, React.CSSProperties> = {
    low: { background: "rgba(34,197,94,0.1)", color: "#16A34A", border: "1px solid rgba(34,197,94,0.2)" },
    medium: { background: "rgba(245,158,11,0.1)", color: "#D97706", border: "1px solid rgba(245,158,11,0.2)" },
    high: { background: "rgba(225,75,75,0.1)", color: "#DC2626", border: "1px solid rgba(225,75,75,0.2)" },
    unknown: { background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" },
  };
  return (
    <span style={{
      ...styles[level],
      padding: "5px 14px",
      borderRadius: 999,
      fontSize: "0.7rem",
      fontWeight: 800,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      fontFamily: "monospace",
      display: "inline-block",
    }}>
      {band?.toUpperCase() ?? "UNKNOWN"}
    </span>
  );
}

function TriageRow({ assessment, index }: { assessment: Assessment; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const risk = getRiskBand(assessment.orchestrator?.overall_risk_band);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 130px 130px 130px 40px",
          alignItems: "center",
          gap: 16,
          padding: "20px 28px",
          borderBottom: "1px solid #E5E7EB",
          cursor: "pointer",
          transition: "background 0.2s ease",
          background: expanded ? "#F9FAFB" : "#fff",
        }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = "#F9FAFB"; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "#fff"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RiskDot band={assessment.orchestrator?.overall_risk_band} />
          <div>
            <div style={{
              fontFamily: "monospace",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#0A1628",
              letterSpacing: "0.03em",
            }}>
              {assessment.patientId}
            </div>
            <div style={{ marginTop: 3, fontSize: "0.75rem", color: "#6B7280", fontWeight: 500 }}>
              {new Date(assessment.createdAt).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </div>
          </div>
        </div>
        <div>
          <RiskPill band={assessment.orchestrator?.overall_risk_band} />
        </div>
        <div style={{ fontSize: "0.8rem", fontFamily: "monospace", fontWeight: 600, color: assessment.ppg?.map ? "#374151" : "#9CA3AF" }}>
          MAP: {assessment.ppg?.map?.toFixed(0) ?? "—"}
        </div>
        <div>
          <RiskPill band={assessment.ppg?.risk_band} />
        </div>
        <div>
          <RiskPill band={assessment.depression?.risk_band} />
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown size={18} style={{ color: "#9CA3AF" }} />
        </motion.div>
      </div>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}
          >
            <div style={{ padding: "24px 28px" }}>
              {assessment.orchestrator?.summary && (
                <div style={{
                  padding: "20px 24px",
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  marginBottom: 20,
                  fontSize: "0.95rem",
                  color: "#374151",
                  lineHeight: 1.7,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0F4C5C", marginBottom: 8 }}>AI Clinical Summary</div>
                  {assessment.orchestrator.summary}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                {[
                  { label: "Neuro Risk", value: assessment.kineticare?.risk_band, band: assessment.kineticare?.risk_band },
                  { label: "Fatigue", value: assessment.kineticare?.fatigue_level, band: undefined },
                  { label: "Depr. Score", value: assessment.depression?.risk_score ? `${(assessment.depression.risk_score * 100).toFixed(0)}%` : "—", band: undefined },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    padding: "16px 20px",
                    background: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: 16,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                  }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: 700, color: "#0A1628" }}>{value ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ClinicianDashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch("/api/all-assessments?limit=100")
      .then((res) => res.json())
      .then((data) => { if (data.assessments) setAssessments(data.assessments); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredAssessments = assessments.filter((a) =>
    a.patientId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const criticalCount = assessments.filter((a) => getRiskBand(a.orchestrator?.overall_risk_band) === "high").length;
  const highDepression = assessments.filter((a) => getRiskBand(a.depression?.risk_band) === "high").length;
  const highNeuro = assessments.filter((a) => getRiskBand(a.kineticare?.risk_band) === "high").length;

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC", color: "#374151", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        padding: "0 40px", height: 76,
        background: "rgba(250,251,252,0.9)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6B7280", fontSize: "0.85rem", fontWeight: 600 }}>
            <ArrowLeft size={16} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "#0F4C5C",
              boxShadow: "0 8px 16px rgba(15,76,92,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShieldCheck size={20} strokeWidth={2} style={{ color: "#fff" }} />
            </div>
            <div>
              <h1 style={{
                fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em",
                color: "#0A1628", margin: 0, lineHeight: 1
              }}>
                CareCommand
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
                <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B7280" }}>Live Cohort Monitoring</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input
              type="text"
              placeholder="Search patient ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: "#fff", border: "1px solid #E5E7EB", borderRadius: 99,
                padding: "10px 16px 10px 44px", width: 280, fontSize: "0.85rem", color: "#374151", outline: "none",
                boxShadow: "0 2px 10px rgba(0,0,0,0.02)", transition: "border-color 0.2s"
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#0F4C5C"}
              onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
            />
          </div>
          <Link href="/daily-checkup" style={{ padding: "10px 24px", background: "#0F4C5C", color: "#fff", borderRadius: 99, fontSize: "0.85rem", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(15,76,92,0.3)" }}>
            New Checkup <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <main style={{ padding: "48px 40px", maxWidth: 1400, margin: "0 auto" }}>
        {/* ── KPI Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginBottom: 48 }}>
          {[
            { label: "Total Patients", value: assessments.length, icon: Users, color: "#0F4C5C" },
            { label: "Critical Alerts", value: criticalCount, icon: AlertCircle, color: "#E14B4B" },
            { label: "High Depression", value: highDepression, icon: Brain, color: "#8B5CF6" },
            { label: "Neuro Anomalies", value: highNeuro, icon: Activity, color: "#F59E0B" },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                padding: "32px",
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 24,
                position: "relative", overflow: "hidden",
                boxShadow: "0 4px 24px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B7280", marginBottom: 16 }}>{label}</div>
              <div style={{
                fontSize: "3.5rem",
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                color,
              }}>
                {loading ? "—" : value}
              </div>
              <Icon
                size={96}
                strokeWidth={1}
                style={{ position: "absolute", right: -16, bottom: -16, color, opacity: 0.08 }}
              />
            </motion.div>
          ))}
        </div>

        {/* ── Triage Roster ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.03)"
          }}
        >
          {/* Table Header */}
          <div style={{
            padding: "24px 28px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#F9FAFB"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <HeartPulse size={20} strokeWidth={2} style={{ color: "#0F4C5C" }} />
              <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0A1628" }}>Patient Roster</span>
              <span style={{ padding: "4px 12px", background: "#E5E7EB", borderRadius: 99, fontSize: "0.7rem", fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>{filteredAssessments.length} patients</span>
            </div>
          </div>

          {/* Column labels */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 130px 130px 130px 40px",
            gap: 16, padding: "16px 28px",
            borderBottom: "1px solid #E5E7EB",
            background: "#fff"
          }}>
            {["Patient ID", "Triage", "MAP", "Vitals", "Mental", ""].map((col) => (
              <div key={col} style={{ fontSize: "0.7rem", fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{col}</div>
            ))}
          </div>

          {/* Rows */}
          <div>
            {loading ? (
              <div style={{ padding: "80px 28px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ width: 32, height: 32, border: "3px solid #E5E7EB", borderTopColor: "#0F4C5C", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <div style={{ fontSize: "0.85rem", color: "#6B7280", fontWeight: 600 }}>Loading cohort data…</div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : filteredAssessments.length === 0 ? (
              <div style={{ padding: "80px 28px", textAlign: "center" }}>
                <Zap size={48} strokeWidth={1.5} style={{ color: "#D1D5DB", marginBottom: 16 }} />
                <div style={{ fontSize: "0.95rem", color: "#6B7280", fontWeight: 600 }}>No assessments found. Sync with MongoDB to populate.</div>
              </div>
            ) : (
              filteredAssessments.map((a, i) => (
                <TriageRow key={a.patientId + i} assessment={a} index={i} />
              ))
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
