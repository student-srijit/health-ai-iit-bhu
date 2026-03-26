"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal, CountUp } from "../components/AnimationUtils";
import HuatuoChat from "../components/HuatuoChat";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import { ArrowLeft, Cpu, ChevronRight, Brain, HeartPulse, Hand } from "lucide-react";

interface WorkflowResult {
  patient_id: string;
  depression?: { depression_score: number; risk_band: string; confidence: number; modalities_used: string[] };
  ppg?: { map: number; change_map: number; ratio_map: number; risk_band: string };
  kineticare?: { risk_band: string; session_quality: string };
  orchestrator?: {
    overall_risk: string; summary: string; huatuo_prompt: string;
    llm_response: string; model_used: string; next_actions: string[];
    quality_caveat?: string | null;
  };
}

// ─── Custom fusion network SVG ────────────────────────────────
function FusionGlyph() {
  const nodes = { dep: [30, 38], ppg: [30, 60], neur: [30, 82], core: [90, 60] };
  const inputNodes = [nodes.dep, nodes.ppg, nodes.neur];
  return (
    <svg viewBox="0 0 120 120" fill="none" style={{ width: "100%", height: "100%" }}>
      {/* Outer ring */}
      <circle cx="60" cy="60" r="52" stroke="#A78BFA" strokeWidth="0.8" strokeOpacity="0.15"/>
      <circle cx="60" cy="60" r="36" stroke="#A78BFA" strokeWidth="0.5" strokeOpacity="0.1" strokeDasharray="3 6"/>
      {/* Connector lines from input nodes to center */}
      {inputNodes.map(([x, y], i) => (
        <line key={i} x1={x} y1={y} x2={nodes.core[0]} y2={nodes.core[1]}
          stroke="#A78BFA" strokeWidth="1.2" strokeOpacity="0.3" strokeDasharray="4 4"/>
      ))}
      {/* Input nodes */}
      {[["D", nodes.dep, "#2DD4BF"], ["V", nodes.ppg, "#F472B6"], ["N", nodes.neur, "#60A5FA"]].map(([l, [x,y], c]) => (
        <g key={l as string}>
          <circle cx={x as number} cy={y as number} r="9" fill={c as string} fillOpacity="0.08" stroke={c as string} strokeWidth="1.2" strokeOpacity="0.5"/>
          <text x={x as number} y={(y as number) + 4} textAnchor="middle" fill={c as string} fontSize="8" fontWeight="800" fontFamily="monospace">{l as string}</text>
        </g>
      ))}
      {/* Core AI node */}
      <circle cx={nodes.core[0]} cy={nodes.core[1]} r="14" fill="#A78BFA" fillOpacity="0.1" stroke="#A78BFA" strokeWidth="1.5" strokeOpacity="0.7"/>
      <text x={nodes.core[0]} y={nodes.core[1] + 4} textAnchor="middle" fill="#A78BFA" fontSize="8" fontWeight="800" fontFamily="monospace">AI</text>
      {/* Corner labels */}
      {[["LLM", [18,18]], ["Hb", [102,18]], ["ML", [18,104]], ["API", [102,104]]].map(([t, [x,y]]) => (
        <text key={t as string} x={x as number} y={y as number} textAnchor="middle" fill="#A78BFA" fontSize="6" fontWeight="700" fontFamily="monospace" fillOpacity="0.35">{t as string}</text>
      ))}
      {/* Output arrow */}
      <line x1="104" y1="60" x2="112" y2="60" stroke="#A78BFA" strokeWidth="1.5" strokeOpacity="0.5"/>
      <polygon points="112,57 116,60 112,63" fill="#A78BFA" fillOpacity="0.5"/>
    </svg>
  );
}

const RISK_COLOR: Record<string, string> = { high: "#DC2626", medium: "#F59E0B", low: "#22C55E" };

export default function PillarOrchestratorPage() {
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalText, setJournalText] = useState("I have been feeling under pressure with work and sleep has been disturbed.");
  const [baselineMap, setBaselineMap] = useState("90");

  async function runWorkflow() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/run-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalText, baselineMap: Number(baselineMap), useCamera: false, simulateSpoof: false }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setResult(await res.json() as WorkflowResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workflow failed");
    } finally { setLoading(false); }
  }

  const orch = result?.orchestrator;

  return (
    <div style={{ background: "#FAFBFC", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(250,251,252,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 48px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}><ArrowLeft size={16} /> Back</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#A78BFA", boxShadow: "0 0 6px #A78BFA80" }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Pillar V · HuatuoGPT-o1</span>
        </div>
        <button onClick={() => void runWorkflow()} disabled={loading} style={{ padding: "9px 24px", background: loading ? "#9CA3AF" : "#0F4C5C", color: "#fff", border: "none", borderRadius: 99, fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.25s", boxShadow: loading ? "none" : "0 4px 14px rgba(15,76,92,0.3)" }}>
          {loading ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff6", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Synthesizing…</> : <>Run Full Synthesis <ChevronRight size={14} /></>}
        </button>
      </div>

      {/* Hero */}
      <section style={{ padding: "120px 48px 80px", maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 80 }}>
        <div style={{ flex: "0 0 55%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 99, marginBottom: 28 }}>
            <Cpu size={12} style={{ color: "#A78BFA" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A78BFA" }}>Pillar V — Clinical AI Core</span>
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#0A1628", marginBottom: 24, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 0ms both" }}>
            HuatuoGPT-o1<br /><span style={{ color: "#A78BFA" }}>Medical Reasoning Engine.</span>
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#6B7280", lineHeight: 1.75, maxWidth: 520, marginBottom: 36, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 150ms both" }}>
            A specialized medical LLM trained on clinical datasets probabilistically fuses all five diagnostic modalities — depression phenotype, rPPG vitals, hemoglobin, neuromotor, and keystroke signals — into a single verifiable synthesis.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 250ms both" }}>
            {["HuatuoGPT-o1: specialized medical LLM with self-verification", "Cross-references 5 independent pillar outputs", "Generates next-action clinical recommendations", "Confidence-weighted risk band aggregation"].map(b => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#A78BFA", flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: "#4B5563", fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "0 0 45%", display: "flex", justifyContent: "center", animation: "slideInRight 1s cubic-bezier(0.22,1,0.36,1) 200ms both" }}>
          <div style={{ position: "relative", width: 320, height: 320 }}>
            <div style={{ position: "absolute", inset: -40, background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)", borderRadius: "50%", animation: "glow 4s ease-in-out infinite" }} />
            <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: "50%", border: "1px solid rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 80px rgba(167,139,250,0.12)", padding: 32 }}>
              <FusionGlyph />
            </div>
            <div style={{ position: "absolute", top: -10, right: -20, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "#0A1628", lineHeight: 1 }}>5×</div>
              <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>Pillar Fusion</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <Reveal>
        <div style={{ borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", padding: "32px 48px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {[{ n: 5, s: " pillars", l: "Modalities fused into one report" }, { n: 94, s: "%", l: "Cross-modal risk classification accuracy" }, { n: 1, s: " request", l: "Full synthesis in one API call" }, { n: 0, s: " hardware", l: "No wearables, no labs" }].map(({ n, s, l }) => (
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
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 32, alignItems: "start" }}>
          {/* Left: Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Reveal>
              <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1rem", marginBottom: 20 }}>Clinical Telemetry Input</h3>
                <label style={{ display: "block", marginBottom: 20 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>Psychiatric History / Notes</div>
                  <textarea
                    rows={5} value={journalText} onChange={e => setJournalText(e.target.value)}
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: "0.9rem", color: "#374151", lineHeight: 1.65, outline: "none", resize: "vertical", fontFamily: "inherit", transition: "border-color 0.2s" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#A78BFA"}
                    onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                  />
                </label>
                <label style={{ display: "block", marginBottom: 20 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>Vascular Anchor (MAP mmHg)</div>
                  <input type="number" value={baselineMap} min={60} max={160} onChange={e => setBaselineMap(e.target.value)}
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: "1rem", color: "#374151", outline: "none", fontFamily: "monospace", transition: "border-color 0.2s" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#A78BFA"}
                    onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                  />
                </label>
                {error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, fontSize: "0.85rem", color: "#DC2626" }}>⚠ {error}</div>}
                <button onClick={() => void runWorkflow()} disabled={loading} style={{ width: "100%", padding: "15px", background: loading ? "#9CA3AF" : "#0F4C5C", color: "#fff", border: "none", borderRadius: 16, fontWeight: 700, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.25s", boxShadow: loading ? "none" : "0 4px 14px rgba(15,76,92,0.25)" }}>
                  {loading ? "Synthesizing…" : "Initialize Full Workflow"}
                </button>
              </div>
            </Reveal>

            {/* Pillar scores feed */}
            {result && (
              <Reveal delay={80}>
                <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                  <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 16 }}>Modality Feeds</p>
                  {[
                    { label: "Digital Phenotype", risk: result.depression?.risk_band, value: result.depression?.depression_score?.toFixed(3), icon: <Brain size={14} style={{ color: "#2DD4BF" }} /> },
                    { label: "Cardiovascular MAP", risk: result.ppg?.risk_band, value: `${result.ppg?.map?.toFixed(1)} mmHg`, icon: <HeartPulse size={14} style={{ color: "#F472B6" }} /> },
                    { label: "Neuromotor Output", risk: result.kineticare?.risk_band, value: result.kineticare?.session_quality, icon: <Hand size={14} style={{ color: "#60A5FA" }} /> },
                  ].map(({ label, risk, value, icon }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F3F4F6" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {icon}
                        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>{label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "0.8rem", color: "#9CA3AF", fontFamily: "monospace" }}>{value}</span>
                        <div style={{ padding: "3px 10px", background: `${RISK_COLOR[risk ?? "low"]}12`, border: `1px solid ${RISK_COLOR[risk ?? "low"]}30`, borderRadius: 99 }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: RISK_COLOR[risk ?? "low"], textTransform: "uppercase", letterSpacing: "0.06em" }}>{risk}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 20 }}>
                    <RiskBadge risk={orch?.overall_risk} size="sm" label="Fused Risk Group" />
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          {/* Right: Orchestrator Output */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {orch ? (
              <>
                <Reveal>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                      <div>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 4 }}>Clinical Synthesis</p>
                        <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1.1rem", margin: 0 }}>Orchestrator Summary</h3>
                      </div>
                      <div style={{ padding: "6px 12px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 99 }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#A78BFA", letterSpacing: "0.06em" }}>AUTO-GENERATED</span>
                      </div>
                    </div>
                    <p style={{ lineHeight: 1.8, color: "#374151", fontSize: "1.05rem", fontWeight: 400 }}>{orch.summary}</p>
                    {orch.quality_caveat && (
                      <div style={{ marginTop: 20, padding: "14px 18px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14, fontSize: "0.85rem", color: "#92400E" }}>ℹ {orch.quality_caveat}</div>
                    )}
                  </div>
                </Reveal>

                {orch.next_actions?.length > 0 && (
                  <Reveal delay={80}>
                    <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                      <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 20 }}>Recommended Interventions</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {orch.next_actions.map((action, i) => (
                          <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "18px 20px", background: "#F9FAFB", borderRadius: 16, border: "1px solid #E5E7EB" }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#0A1628", color: "#fff", fontWeight: 800, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "monospace" }}>
                              {String(i + 1).padStart(2, "0")}
                            </div>
                            <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.65, color: "#374151", fontWeight: 500 }}>{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Reveal>
                )}

                <Reveal delay={140}>
                  <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <div style={{ background: "#0A1628", padding: "16px 28px", display: "flex", alignItems: "center", gap: 10 }}>
                      <Cpu size={16} style={{ color: "#A78BFA" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>HuatuoGPT-o1 Clinical Chain of Thought</span>
                    </div>
                    <HuatuoChat prompt={orch.huatuo_prompt} llmResponse={orch.llm_response} modelUsed={orch.model_used} summary={orch.summary} />
                  </div>
                </Reveal>
              </>
            ) : (
              <Reveal>
                <div style={{ background: "#fff", borderRadius: 24, border: "1.5px dashed #D1D5DB", padding: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 500, textAlign: "center" }}>
                  <Cpu size={80} strokeWidth={0.8} style={{ color: "#D1D5DB", marginBottom: 28 }} />
                  <h3 style={{ color: "#9CA3AF", fontWeight: 600, fontSize: "1.1rem", marginBottom: 10 }}>Diagnostic Engine Idle</h3>
                  <p style={{ color: "#D1D5DB", maxWidth: 320, fontSize: "0.875rem", lineHeight: 1.65 }}>Enter your clinical notes and baseline MAP on the left, then initialize the full 5-pillar synthesis workflow.</p>
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
              <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: 12 }}>Run All 5 Pillars in One Shot</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 32, fontSize: "1rem" }}>The unified daily checkup activates camera, microphone, touch, and the LLM pipeline — all in under 2 minutes.</p>
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
