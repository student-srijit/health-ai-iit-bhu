"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Reveal, CountUp } from "../components/AnimationUtils";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import { ArrowLeft, Droplets, ChevronRight, Upload } from "lucide-react";

type BloodResult = {
  patient_id: string; hemoglobin_g_dl: number; risk_band: string;
  confidence: number; roi_quality: number; method: string; warnings?: string[];
};
type RunCheckResponse = { blood?: BloodResult; warnings?: string[]; error?: string };

// ─── Custom conjunctiva cross-section glyph ───────────────────
function ConjunctivaGlyph() {
  return (
    <svg viewBox="0 0 120 120" fill="none" style={{ width: "100%", height: "100%" }}>
      {/* Outer eyelid shape */}
      <path d="M 10 60 Q 60 20 110 60 Q 60 100 10 60 Z" fill="#E14B4B" fillOpacity="0.06" stroke="#E14B4B" strokeWidth="1.2" strokeOpacity="0.4"/>
      {/* Inner circle — conjunctiva ROI */}
      <circle cx="60" cy="60" r="16" fill="#E14B4B" fillOpacity="0.08" stroke="#E14B4B" strokeWidth="1.2" strokeOpacity="0.5"/>
      <circle cx="60" cy="60" r="8" fill="#E14B4B" fillOpacity="0.15"/>
      {/* Hemoglobin scatter dots */}
      {[[45,52],[52,48],[68,50],[74,58],[47,67],[65,65],[58,55]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="#E14B4B" fillOpacity={0.4 + i*0.08}/>
      ))}
      {/* Scan lines */}
      <line x1="18" y1="60" x2="42" y2="60" stroke="#E14B4B" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="2 3"/>
      <line x1="78" y1="60" x2="102" y2="60" stroke="#E14B4B" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="2 3"/>
      {/* Color wheel reference */}
      <circle cx="60" cy="60" r="28" stroke="#E14B4B" strokeWidth="0.5" strokeOpacity="0.1" strokeDasharray="3 5"/>
      <circle cx="60" cy="60" r="42" stroke="#E14B4B" strokeWidth="0.5" strokeOpacity="0.07" strokeDasharray="2 8"/>
      {/* Corner glyph labels */}
      {[["Hb", [18,16]], ["ROI", [98,16]], ["CNN", [18,108]], ["SVM", [98,108]]].map(([l, [x,y]]) => (
        <text key={l as string} x={x as number} y={y as number} textAnchor="middle" fill="#E14B4B" fontSize="7" fontWeight="700" fontFamily="monospace" fillOpacity="0.4">{l as string}</text>
      ))}
    </svg>
  );
}

export default function PillarBloodPage() {
  const [imageBase64, setImageBase64] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<BloodResult | null>(null);
  const [workflowWarnings, setWorkflowWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setImageBase64(dataUrl); setPreviewUrl(dataUrl); setResult(null); setWorkflowWarnings([]); setError(null);
  }

  async function runBloodCheck() {
    if (!imageBase64) { setError("Upload a clear inner-eye image first."); return; }
    if (imageBase64.length < 100) { setError(`Image too small (${imageBase64.length} chars). Upload a larger file.`); return; }
    setLoading(true); setError(null); setWorkflowWarnings([]);
    try {
      const res = await fetch("/api/run-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalText: "blood screening", baselineMap: 90, useCamera: false, simulateSpoof: false, bloodImageBase64: imageBase64 }),
      });
      const data = (await res.json()) as RunCheckResponse;
      if (!res.ok) { setError(data.error ?? `Request failed (${res.status})`); setResult(null); return; }
      if (!data.blood) { setError("Blood result was not returned by the backend."); setResult(null); return; }
      setResult(data.blood); setWorkflowWarnings(data.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blood check failed"); setResult(null);
    } finally { setLoading(false); }
  }

  const confidencePct = useMemo(() => result ? `${Math.round(result.confidence * 100)}%` : "—", [result]);

  return (
    <div style={{ background: "#FAFBFC", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(250,251,252,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 48px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}><ArrowLeft size={16} /> Back</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E14B4B", boxShadow: "0 0 6px #E14B4B80" }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Pillar III · Blood Health</span>
        </div>
        <button onClick={() => void runBloodCheck()} disabled={loading || !imageBase64} style={{ padding: "9px 24px", background: (loading || !imageBase64) ? "#9CA3AF" : "#0F4C5C", color: "#fff", border: "none", borderRadius: 99, fontSize: "0.875rem", fontWeight: 600, cursor: (loading || !imageBase64) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.25s", boxShadow: (loading || !imageBase64) ? "none" : "0 4px 14px rgba(15,76,92,0.3)" }}>
          {loading ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff6", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Analyzing…</> : <>Run Hb Analysis <ChevronRight size={14} /></>}
        </button>
      </div>

      {/* Hero */}
      <section style={{ padding: "120px 48px 80px", maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 80 }}>
        <div style={{ flex: "0 0 55%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(225,75,75,0.08)", border: "1px solid rgba(225,75,75,0.2)", borderRadius: 99, marginBottom: 28 }}>
            <Droplets size={12} style={{ color: "#E14B4B" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#E14B4B" }}>Pillar III — Blood Health</span>
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#0A1628", marginBottom: 24, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 0ms both" }}>
            Hemoglobin Analysis<br /><span style={{ color: "#E14B4B" }}>Without a Blood Draw.</span>
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#6B7280", lineHeight: 1.75, maxWidth: 520, marginBottom: 36, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 150ms both" }}>
            A photograph of your lower inner eyelid (conjunctiva) is analyzed by a CNN+SVM ensemble to estimate hemoglobin level and anemia risk band with ROI quality confidence scoring.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 250ms both" }}>
            {["CNN + SVM ensemble for Hb estimation", "Automatic ROI localization from inner eyelid", "Anemia risk band classification (low/medium/high)", "No blood draw — just a smartphone photo"].map(b => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E14B4B", flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: "#4B5563", fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "0 0 45%", display: "flex", justifyContent: "center", animation: "slideInRight 1s cubic-bezier(0.22,1,0.36,1) 200ms both" }}>
          <div style={{ position: "relative", width: 320, height: 320 }}>
            <div style={{ position: "absolute", inset: -40, background: "radial-gradient(circle, rgba(225,75,75,0.08) 0%, transparent 70%)", borderRadius: "50%", animation: "glow 4s ease-in-out infinite" }} />
            <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: "50%", border: "1px solid rgba(225,75,75,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 80px rgba(225,75,75,0.10)", padding: 32 }}>
              <ConjunctivaGlyph />
            </div>
            {[{ l: "12.5+", s: "g/dL Hb", top: -10, right: -20 }, { l: "1 photo", s: "Required", bottom: 20, left: -30 }].map(({ l, s, ...pos }) => (
              <div key={s} style={{ position: "absolute", ...pos, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0A1628", lineHeight: 1 }}>{l}</div>
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
            {[{ n: 85, s: "%", l: "Hb band classification accuracy" }, { n: 1, s: " photo", l: "Input required" }, { n: 2, s: " models", l: "CNN + SVM ensemble" }, { n: 0, s: " needles", l: "Non-invasive, zero blood draw" }].map(({ n, s, l }) => (
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
          {/* Left: upload */}
          <Reveal>
            <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontWeight: 700, color: "#0A1628", fontSize: "1rem", marginBottom: 8 }}>Inner-Eye Image Upload</h3>
              <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.65, marginBottom: 24 }}>
                Pull down your lower eyelid with a clean finger under bright lighting. Photograph the pink inner surface. Upload that image here.
              </p>
              {/* Dropzone */}
              <label
                htmlFor="bloodImageInput"
                style={{
                  display: "block", cursor: "pointer",
                  border: `2px dashed ${isDragging ? "#E14B4B" : (previewUrl ? "#22C55E" : "rgba(225,75,75,0.25)")}`,
                  borderRadius: 20, padding: previewUrl ? 0 : 48,
                  background: isDragging ? "rgba(225,75,75,0.04)" : (previewUrl ? "#000" : "rgba(225,75,75,0.02)"),
                  textAlign: "center",
                  transition: "all 0.2s",
                  overflow: "hidden",
                }}
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDrop={() => setIsDragging(false)}
              >
                <input id="bloodImageInput" type="file" accept="image/*" onChange={e => void onFileChange(e)} style={{ display: "none" }} />
                {previewUrl ? (
                  <img src={previewUrl} alt="Conjunctiva preview" style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 280, borderRadius: 18 }} />
                ) : (
                  <>
                    <Upload size={32} style={{ color: "rgba(225,75,75,0.4)", marginBottom: 12 }} />
                    <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>Click or drag photo here</div>
                    <div style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>JPG, PNG, HEIC accepted</div>
                  </>
                )}
              </label>
              {previewUrl && (
                <button onClick={() => { setPreviewUrl(""); setImageBase64(""); setResult(null); }} style={{ marginTop: 12, width: "100%", padding: "10px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, fontWeight: 600, color: "#6B7280", cursor: "pointer", fontSize: "0.875rem", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#E14B4B"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                >
                  Change Image
                </button>
              )}
              {error && <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, fontSize: "0.85rem", color: "#DC2626" }}>⚠ {error}</div>}
              <div style={{ marginTop: 20, padding: "16px 18px", background: "#FFF7F7", border: "1px solid rgba(225,75,75,0.12)", borderRadius: 14 }}>
                <p style={{ fontSize: "0.8rem", color: "#9CA3AF", lineHeight: 1.65, margin: 0 }}>
                  <strong style={{ color: "#374151" }}>Tip:</strong> Uniform lighting (near a window) dramatically improves ROI quality score and Hb estimate accuracy.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Right: results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {result ? (
              <>
                <Reveal>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <RiskBadge risk={result.risk_band} score={result.risk_band === "high" ? 0.85 : result.risk_band === "medium" ? 0.55 : 0.2} size="lg" label="Anemia Risk Assessment" />
                  </div>
                </Reveal>
                <Reveal delay={80}>
                  <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #E5E7EB", padding: 36, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ fontWeight: 700, color: "#0A1628", marginBottom: 20, fontSize: "1rem" }}>Hemoglobin Metrics</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <MetricCard icon="🩸" label="Hemoglobin" value={result.hemoglobin_g_dl.toFixed(2)} unit="g/dL" accent="#E14B4B" />
                      <MetricCard icon="🎯" label="Confidence" value={confidencePct} accent="#9CA3AF" />
                      <MetricCard icon="🧪" label="ROI Quality" value={`${Math.round(result.roi_quality * 100)}%`} accent="#0ea5e9" />
                      <MetricCard icon="⚙" label="Method" value={result.method} accent="#9CA3AF" />
                    </div>
                    {(result.warnings?.length ?? 0) > 0 && (
                      <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, fontSize: "0.85rem", color: "#92400E" }}>
                        {result.warnings?.map((w, i) => <div key={i}>⚠ {w}</div>)}
                      </div>
                    )}
                    {workflowWarnings.length > 0 && <div style={{ marginTop: 10, fontSize: "0.85rem", color: "#9CA3AF" }}>{workflowWarnings.join(" ")}</div>}
                  </div>
                </Reveal>
              </>
            ) : (
              <Reveal>
                <div style={{ background: "#fff", borderRadius: 24, border: "1.5px dashed #D1D5DB", padding: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 440, textAlign: "center" }}>
                  <Droplets size={80} strokeWidth={0.8} style={{ color: "#D1D5DB", marginBottom: 28 }} />
                  <h3 style={{ color: "#9CA3AF", fontWeight: 600, fontSize: "1.1rem", marginBottom: 10 }}>Awaiting Image</h3>
                  <p style={{ color: "#D1D5DB", maxWidth: 280, fontSize: "0.875rem", lineHeight: 1.65 }}>Upload an inner-eyelid photograph to begin hemoglobin estimation.</p>
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
              <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: 12 }}>Combine All 5 Pillars</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 32, fontSize: "1rem" }}>Add blood analysis to your mental, cardiac, and neuro signals for a full AI-synthesized clinical report.</p>
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
