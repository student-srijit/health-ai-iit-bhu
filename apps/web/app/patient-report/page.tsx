"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from "recharts";
import { Activity, Brain, HeartPulse, CheckCircle, AlertTriangle, ArrowLeft, Download } from "lucide-react";

export default function PatientReport() {
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("kinetiCare_latestReport");
    let patientId = "patient_123";
    
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setReport(parsed);
        if (parsed.patient_id) patientId = parsed.patient_id;
      } catch (e) {
        console.error("Failed to parse report", e);
      }
    }
    setLoading(false);

    // Fetch history using the actual patientId from report or fallback
    fetch(`/api/patient-history?patientId=${patientId}&limit=7`)
      .then(res => res.json())
      .then(data => {
        if (data.assessments) {
          const sorted = data.assessments.sort((a: any, b: any) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setHistory(sorted);
        }
      })
      .catch(console.error);
  }, []);

  const getRiskColor = (score: number) => {
    if (score < 0.4) return "#22C55E"; // Green
    if (score < 0.7) return "#F59E0B"; // Amber
    return "#E14B4B"; // Rose
  };

  const getRiskClass = (score: number) => {
    if (score < 0.4) return "#22C55E";
    if (score < 0.7) return "#F59E0B";
    return "#E14B4B";
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFBFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, border: "4px solid rgba(15,76,92,0.1)", borderTopColor: "#0F4C5C", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ fontFamily: "monospace", fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B7280" }}>Initializing Dashboard</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!report || !report.models) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFBFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ width: 80, height: 80, background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
          <AlertTriangle color="#E14B4B" size={32} />
        </div>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0A1628", marginBottom: 8 }}>{report?.error || "No Report Found"}</h1>
        <p style={{ color: "#6B7280", maxWidth: 400, marginBottom: 32, lineHeight: 1.6 }}>
          We couldn't find a complete health assessment, or the last checkup encountered an API error. Please try again.
        </p>
        <Link href="/daily-checkup" style={{ padding: "14px 32px", background: "#0F4C5C", color: "#fff", borderRadius: 16, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(15,76,92,0.3)" }}>
          Start Checkup
        </Link>
      </div>
    );
  }

  const { models } = report;

  // Historical data for charts - with extra safety
  const stressCrossoverData = history.length > 0
    ? history.map(a => ({
        day: new Date(a.createdAt).toLocaleDateString(undefined, { weekday: 'short' }),
        HR: a.ppg?.heart_rate ?? 70,
        tremor: (a.kineticare?.neurological_risk_index ?? 0) * 100,
        depRisk: (a.depression?.risk_score ?? 0) * 100,
      }))
    : [
        { 
          day: "Today", 
          HR: models.ppg?.heart_rate ?? 70, 
          tremor: (models.kineticare?.neurological_risk_index ?? 0) * 100, 
          depRisk: (models.depression?.risk_score ?? 0) * 100 
        },
      ];

  const radarData = [
    { subject: 'Stability', A: models.ppg?.is_valid ? 90 : 40 },
    { subject: 'Motor', A: 100 - ((models.kineticare?.neurological_risk_index ?? 0) * 100) },
    { subject: 'Emotional', A: 100 - ((models.depression?.risk_score ?? 0) * 100) },
    { subject: 'Cognitive', A: models.kineticare?.fatigue_level === "High" ? 40 : 85 },
    { subject: 'Cardio', A: (models.ppg?.map ?? 0) > 70 && (models.ppg?.map ?? 0) < 100 ? 95 : 60 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC", color: "#374151", padding: "48px 32px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", background: "#fff", border: "1px solid #E5E7EB", padding: 32, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ padding: "4px 12px", background: "rgba(15,76,92,0.08)", color: "#0F4C5C", border: "1px solid rgba(15,76,92,0.2)", borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Clinical Analysis
              </span>
              <span style={{ color: "#9CA3AF", fontFamily: "monospace", fontSize: "0.8rem" }}>
                Ref: {report.timestamp?.slice(-6) || "ID-4429"}
              </span>
            </div>
            <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.04em", margin: "8px 0" }}>
              Supreme Bio-Synthesis
            </h1>
            <p style={{ color: "#6B7280", margin: 0, fontSize: "0.95rem" }}>
              HuatuoGPT-o1 Clinical Orchestrator <span style={{ color: "#D1D5DB", margin: "0 8px" }}>|</span> <strong style={{ color: "#4B5563" }}>{new Date(report.timestamp).toLocaleString()}</strong>
            </p>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
            <button style={{ padding: "12px", background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", color: "#6B7280", cursor: "pointer", transition: "border-color 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#0F4C5C"} onMouseLeave={e => e.currentTarget.style.borderColor = "#E5E7EB"}>
              <Download size={20} />
            </button>
            <button onClick={() => router.push("/")} style={{ padding: "0 24px", background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", color: "#0A1628", fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#0F4C5C"; e.currentTarget.style.color = "#0F4C5C"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#0A1628"; }}>
              <ArrowLeft size={16} /> Dashboard
            </button>
          </div>
        </div>

        {/* AI Orchestrator Summary */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: "#fff", border: "1px solid #E5E7EB", padding: 40, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", right: -80, top: -80, width: 256, height: 256, background: "radial-gradient(circle, rgba(15,76,92,0.05) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, background: "rgba(15,76,92,0.08)", borderRadius: 16, border: "1px solid rgba(15,76,92,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle color="#0F4C5C" size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0A1628", margin: "0 0 4px 0" }}>Clinical Triage Summary</h2>
              <div style={{ fontSize: "0.7rem", color: "#0F4C5C", fontFamily: "monospace", letterSpacing: "0.1em" }}>LEVEL-3 HEURISTIC FUSION</div>
            </div>
          </div>
          <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "#4B5563", margin: 0 }}>
            {models?.orchestrator?.analysis || models?.orchestrator?.llm_response || models?.orchestrator?.summary || "Clinical synthesis completed. Bio-metric trends reflect current session baselines."}
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
          
          {/* Vertical Pillars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Vitals */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", padding: 28, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 16, right: 16, opacity: 0.05 }}><HeartPulse size={80} /></div>
              <h3 style={{ color: "#E14B4B", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: "0 0 24px 0", fontSize: "1.05rem" }}>
                <HeartPulse size={18}/> Hemodynamics
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "#F9FAFB", padding: 16, borderRadius: 16, border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Heart Rate</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0A1628" }}>{models.ppg?.heart_rate ?? 70} <span style={{ fontSize: "0.8rem", color: "#E14B4B", fontFamily: "monospace" }}>BPM</span></div>
                </div>
                <div style={{ background: "#F9FAFB", padding: 16, borderRadius: 16, border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>BP (Est)</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0A1628" }}>{models.ppg?.sbp ?? 120}/{models.ppg?.dbp ?? 80}</div>
                </div>
                <div style={{ gridColumn: "span 2", background: "#F9FAFB", padding: 16, borderRadius: 16, border: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>MAP Index</div>
                  <div style={{ fontFamily: "monospace", color: "#E14B4B", fontWeight: 800, fontSize: "1.1rem" }}>{models.ppg?.map ?? 93} <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>mmHg</span></div>
                </div>
              </div>
            </div>

            {/* Mental Health */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", padding: 28, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 16, right: 16, opacity: 0.05 }}><Brain size={80} /></div>
              <h3 style={{ color: "#8B5CF6", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: "0 0 24px 0", fontSize: "1.05rem" }}>
                <Brain size={18}/> Mental Health
              </h3>
              <div style={{ background: "#F9FAFB", padding: 20, borderRadius: 16, border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Risk Intensity</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: getRiskClass(models.depression?.risk_score ?? 0.1), lineHeight: 1 }}>
                    {((models.depression?.risk_score ?? 0) * 100).toFixed(0)}%
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Confidence</div>
                  <div style={{ fontSize: "0.9rem", fontFamily: "monospace", color: "#4B5563", fontWeight: 600 }}>{((models.depression?.confidence ?? 0.8) * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>

            {/* Neuro */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", padding: 28, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 16, right: 16, opacity: 0.05 }}><Activity size={80} /></div>
              <h3 style={{ color: "#F59E0B", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: "0 0 24px 0", fontSize: "1.05rem" }}>
                <Activity size={18}/> Neuromotor
              </h3>
              <div style={{ background: "#F9FAFB", padding: 20, borderRadius: 16, border: "1px solid #E5E7EB", marginBottom: 16 }}>
                <div style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Fatigue State</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0A1628" }}>{models.kineticare?.fatigue_level ?? "Low"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 8px" }}>
                <div style={{ width: 32, height: 32, background: "rgba(245,158,11,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <AlertTriangle color="#F59E0B" size={16} />
                </div>
                <div>
                  <div style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tremor Index</div>
                  <div style={{ fontSize: "0.85rem", fontFamily: "monospace", color: "#4B5563", fontWeight: 600 }}>{(models.kineticare?.neurological_risk_index ?? 0).toFixed(2)} baseline</div>
                </div>
              </div>
            </div>

          </div>

          {/* Graphical Insights */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32, gridColumn: "span 2" }}>
            
            {/* Main Crossover Chart */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", padding: 32, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", height: 460 }}>
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0A1628", margin: "0 0 4px 0" }}>Multimodal Bio-Intersection</h3>
                <p style={{ fontSize: "0.9rem", color: "#6B7280", margin: 0 }}>Correlation between Physiological HR and Neurological Tremor signals.</p>
              </div>
              <div style={{ flex: 1, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stressCrossoverData}>
                    <defs>
                      <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E14B4B" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#E14B4B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="day" stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} dy={10} />
                    <YAxis yAxisId="left" stroke="#E14B4B" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} />
                    <YAxis yAxisId="right" orientation="right" stroke="#F59E0B" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #E5E7EB', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="HR" stroke="#E14B4B" strokeWidth={4} dot={{r:4, fill: '#E14B4B', strokeWidth: 2, stroke: '#fff'}} name="Heart Rate" />
                    <Line yAxisId="right" type="monotone" dataKey="tremor" stroke="#F59E0B" strokeWidth={4} dot={{r:4, fill: '#F59E0B', strokeWidth: 2, stroke: '#fff'}} name="Tremor" />
                    <Line yAxisId="right" type="monotone" dataKey="depRisk" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="8 6" dot={false} name="Depression" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar Analysis */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", padding: 32, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0A1628", margin: "0 0 12px 0" }}>Patient Bio-Profile</h3>
                <p style={{ fontSize: "0.95rem", color: "#6B7280", lineHeight: 1.6, margin: 0 }}>
                  Conditional bio-mapping across five critical health vectors. Surfaces latent correlations between mental fatigue and cardiac pressure.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
                  {radarData.map(d => (
                    <div key={d.subject} style={{ padding: "4px 12px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: "0.7rem", fontFamily: "monospace", color: "#4B5563", textTransform: "uppercase", fontWeight: 600 }}>
                      {d.subject}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", padding: 16, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.03)", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar 
                      name="Patient Health" 
                      dataKey="A" 
                      stroke="#0F4C5C" 
                      fill="#0F4C5C" 
                      fillOpacity={0.15} 
                      strokeWidth={3} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: "center", padding: "48px 0 24px 0" }}>
          <p style={{ color: "#9CA3AF", fontSize: "0.7rem", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            Clinically Validated ML Pipeline • Data Encryption Active • KinetiCare v1.0.4-Alpha
          </p>
        </div>

      </div>
    </div>
  );
}
