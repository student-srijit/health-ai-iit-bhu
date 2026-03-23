"use client";

import { useRef, useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import VideoCapture from "../components/VideoCapture";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";
import HuatuoChat from "../components/HuatuoChat";

interface CapturedFeatures {
  audioFeatures: number[];
  videoFeatures: number[];
  framesProcessed: number;
  cameraMetrics: {
    frame_quality_score: number;
    blur_score: number;
    face_tracking_confidence: number;
    spoof_probability: number;
    accepted_window_ratio: number;
    laplacian_variance: number;
    frequency_spoof_score: number;
  };
}

interface DepressionResult {
  patient_id: string;
  depression_score: number;
  risk_band: string;
  confidence: number;
  modalities_used: string[];
  status: string;
  error_message?: string | null;
  camera_sqi?: number | null;
}

interface KineticareResult {
  risk_band: string;
  session_quality: string;
  feature_summary: {
    dwell_mean_ms: number;
    flight_mean_ms: number;
    tremor_ratio_4_6hz: number;
  };
}

interface OrchestratorResult {
  overall_risk: string;
  llm_response: string;
}

interface AnalysisPayload {
  depression?: DepressionResult;
  kineticare?: KineticareResult;
  orchestrator?: OrchestratorResult;
  patient_id?: string;
  warnings?: string[];
}

export default function PillarDepressionPage() {
  const [journalText, setJournalText] = useState("");
  const [features, setFeatures] = useState<CapturedFeatures | null>(null);
  const [result, setResult] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulateSpoof, setSimulateSpoof] = useState(false);
  const patientIdRef = useRef<string>(crypto.randomUUID());

  // KinetiCare Sensors
  const keyPressMap = useRef<Record<string, number>>({});
  const lastKeyRelease = useRef<number | null>(null);
  const imuFirstTs = useRef<number | null>(null);
  const imuLastTs = useRef<number | null>(null);
  const dwellTimes = useRef<number[]>([]);
  const flightTimes = useRef<number[]>([]);
  const imuBuffer = useRef<number[]>([]);

  // Invisible IMU Micro-tremor collection
  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (acc) {
        const mag = Math.sqrt((acc.x || 0)**2 + (acc.y || 0)**2 + (acc.z || 0)**2);
        if (mag > 0) {
          imuBuffer.current.push(mag);
          const now = performance.now();
          if (imuFirstTs.current === null) imuFirstTs.current = now;
          imuLastTs.current = now;
        }
      }
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const now = performance.now();
    if (!keyPressMap.current[e.key]) {
      keyPressMap.current[e.key] = now;
      if (lastKeyRelease.current) {
        flightTimes.current.push(now - lastKeyRelease.current);
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    const now = performance.now();
    const pressedAt = keyPressMap.current[e.key];
    if (pressedAt) {
      dwellTimes.current.push(now - pressedAt);
      delete keyPressMap.current[e.key];
    }
    lastKeyRelease.current = now;
  };

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const imuRate =
        imuFirstTs.current !== null &&
        imuLastTs.current !== null &&
        imuLastTs.current > imuFirstTs.current
          ? imuBuffer.current.length / ((imuLastTs.current - imuFirstTs.current) / 1000)
          : null;

      const requestBody: Record<string, unknown> = {
        journalText,
        baselineMap: 90,
        useCamera: !!features,
        simulateSpoof,
        audioFeatures: features?.audioFeatures,
        videoFeatures: features?.videoFeatures,
        cameraMetrics: features?.cameraMetrics,
        patientId: patientIdRef.current,
      };

      if (imuRate && dwellTimes.current.length >= 8 && flightTimes.current.length >= 8 && imuBuffer.current.length >= 64) {
        requestBody.dwellTimes = dwellTimes.current;
        requestBody.flightTimes = flightTimes.current;
        requestBody.imuAccelMagnitude = imuBuffer.current;
        requestBody.kineticareSamplingRateHz = imuRate;
      }

      const res = await fetch("/api/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as AnalysisPayload;
      if (data.patient_id) patientIdRef.current = data.patient_id;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const depression = result?.depression;
  const kineticare = result?.kineticare;
  const orchestrator = result?.orchestrator;

  const huatuoPrompt =
    depression && orchestrator
      ? `You are HuatuoGPT-o1. System output: ${orchestrator.llm_response}`
      : undefined;

  return (
    <div style={{ background: "var(--bg-gradient)", minHeight: "100vh" }}>
      <Navbar />
      <main className="container" style={{ padding: "40px 20px 100px" }}>
        {/* Hero */}
        <div className="animate-slide-up" style={{ marginBottom: 40, maxWidth: 800 }}>
          <div className="tag" style={{ marginBottom: 16, background: "#f8fafc", color: "var(--accent-teal)", borderColor: "#e2e8f0" }}>
            🧠 Modality I — Digital Phenotype
          </div>
          <h1>Psychiatric Diagnostics</h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: 700, marginTop: 12, fontSize: "1.1rem", lineHeight: 1.6 }}>
            Rapid multimodality mental health extraction isolating vocal biomarkers, sentiment embeddings, and invisible facial micro-expressions processed via our LSTM-Highway fusion framework.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: "start", gap: 32 }}>
          {/* Left column — inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Video capture */}
            <div className="glass-card" style={{ padding: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--accent-teal)" }}>🎥</span> 30-Second Facial Telemetry
                </h3>
                {features && <span className="tag" style={{ background: "#dcfce7", color: "var(--risk-low)", borderColor: "#bbf7d0" }}>✓ Synchronized</span>}
              </div>
              <p className="text-sm text-muted" style={{ marginBottom: 24 }}>
                 Execute a 30-second localized capture to extract kinematic facial markers. Videos never leave the device—only vector projections are relayed.
              </p>
              <div style={{ borderRadius: "12px", overflow: "hidden", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                 <VideoCapture onCapture={setFeatures} duration={30} />
              </div>
            </div>

            {/* Journal text */}
            <div className="glass-card" style={{ padding: 32 }}>
              <h3 style={{ marginBottom: 20 }}>Linguistic Sentiment Log</h3>
              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div className="label">Clinical Note (Invisible KinetiCare Keystroke Sensors Active)</div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "var(--text-muted)", cursor: "pointer" }}>
                    <input type="checkbox" checked={simulateSpoof} onChange={e => setSimulateSpoof(e.target.checked)} />
                    Simulate Camera Deepfake/Filter (Anti-Spoof Demo)
                  </label>
                </div>
                <textarea
                  className="input-premium"
                  rows={4}
                  value={journalText}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  onChange={(e) => setJournalText(e.target.value)}
                  placeholder="Patient reports feelings of severe exhaustion. Describe mood..."
                />
              </label>
              <button
                className="btn btn-primary"
                style={{ width: "100%", padding: "16px 20px" }}
                onClick={() => void runAnalysis()}
                disabled={loading || !journalText.trim()}
              >
                {loading ? <><span className="spinner spinner-dark" /> Compiling Tensor Streams…</> : "Initiate Phenotype Extraction"}
              </button>
              {error && <div className="disclaimer" style={{ marginTop: 16 }}><span className="disclaimer-icon">⚠</span> {error}</div>}
            </div>
          </div>

          {/* Right column — results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {depression && kineticare ? (
              <>
                {/* Anti-Spoofing Block */}
                {depression.status === "blocked" && (
                  <div className="glass-card animate-slide-up" style={{ padding: 24, background: "#fff1f2", border: "1px solid #fecdd3" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <div className="status-indicator error" />
                      <div>
                        <h4 style={{ margin: 0, color: "var(--risk-high)" }}>Biometric Interference Detected</h4>
                        <p style={{ margin: 0, marginTop: 4, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                           Anti-Spoofing & SQI Noise Cancellation pipeline triggered. Please disable camera filters and ensure natural lighting to proceed with Facial Phenotype extraction. Falling back to KinetiCare neurological tracking.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ display: "flex", gap: 24 }}>
                  {/* Risk ring */}
                  <div className="glass-card animate-slide-up" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20 }}>
                    <RiskBadge risk={orchestrator?.overall_risk || depression.risk_band} score={depression.depression_score} size="lg" label="Overall Neural Risk" />
                    <div style={{ textAlign: "center", background: "#f8fafc", padding: "8px 16px", borderRadius: 999, border: "1px solid #e2e8f0" }}>
                      <span className="label" style={{ marginRight: 8 }}>Camera Status</span>
                      <span style={{ fontWeight: 800, color: depression.status === "blocked" ? "var(--risk-high)" : "var(--risk-low)", fontSize: "0.85rem" }}>
                        {depression.status === "blocked" ? "⛔ Rejected (Spoof/SQI)" : "✓ " + depression.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Modalities used */}
                  <div className="glass-card flex-col justify-between" style={{ padding: 32, flex: 1 }}>
                     <h3 style={{ marginBottom: 16 }}>Included Signals</h3>
                     <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: "auto" }}>
                        {depression.modalities_used.map((m: string) => (
                          <div key={m} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                             <span style={{ color: "var(--accent-teal)", fontWeight: 800 }}>✓</span>
                             <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>{m}</span>
                          </div>
                        ))}
                     </div>
                     {depression.camera_sqi !== null && depression.camera_sqi !== undefined && (
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                           <span className="label">Camera SQI Index</span>
                           <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>{depression.camera_sqi.toFixed(2)}</div>
                        </div>
                     )}
                  </div>
                </div>

                {/* KinetiCare Metrics */}
                <h3 style={{ marginTop: 8 }}>Invisible Neuro-Motor Telemetry (KinetiCare)</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <MetricCard
                    icon="⌨️"
                    label="Keystroke Dwell/Flight Mean"
                    value={`${kineticare.feature_summary.dwell_mean_ms.toFixed(0)}/${kineticare.feature_summary.flight_mean_ms.toFixed(0)}`}
                    unit="ms"
                    accent={kineticare.risk_band === "high" ? "var(--risk-high)" : "var(--accent-teal)"}
                  />
                  <MetricCard
                    icon="📳"
                    label="IMU Resting Tremor Extract (FFT)"
                    value={kineticare.feature_summary.tremor_ratio_4_6hz.toFixed(3)}
                    unit="ratio"
                    accent={kineticare.feature_summary.tremor_ratio_4_6hz > 0.4 ? "var(--risk-high)" : "var(--risk-low)"}
                  />
                </div>

                {/* Metrics grid */}
                <h3 style={{ marginTop: 8 }}>Facial Phenotype Extraction</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <MetricCard
                    icon="📊"
                    label="Phenotype Embedding"
                    value={depression.depression_score.toFixed(3)}
                    accent={depression.risk_band === "high" ? "var(--risk-high)" : depression.risk_band === "medium" ? "var(--risk-medium)" : "var(--risk-low)"}
                  />
                  <MetricCard
                    icon="🎯"
                    label="Model Confidence"
                    value={`${Math.round(depression.confidence * 100)}%`}
                    accent="var(--accent-teal)"
                  />
                </div>



                {depression.error_message && (
                  <div className="disclaimer">
                     <span className="disclaimer-icon">⚠</span>
                     {depression.error_message}
                  </div>
                )}

                {result?.warnings?.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.warnings.map((warning) => (
                      <div key={warning} className="disclaimer">
                        <span className="disclaimer-icon">⚠</span>
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* HuatuoGPT reasoning */}
                <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                  <HuatuoChat prompt={huatuoPrompt} />
                </div>
              </>
            ) : (
              <div className="glass-card" style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, border: "1px dashed #cbd5e1" }}>
                <div style={{ fontSize: "3.5rem", marginBottom: 24, opacity: 0.8 }}>🧠</div>
                <h3 style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Awaiting Telemetry</h3>
                <p style={{ color: "var(--text-muted)", textAlign: "center", maxWidth: 300 }}>
                  Launch the Phenotype Extraction to generate psychiatric biomarker inferences and neural network confidence metrics.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
