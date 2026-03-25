"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";

type BloodResult = {
  patient_id: string;
  hemoglobin_g_dl: number;
  risk_band: string;
  confidence: number;
  roi_quality: number;
  method: string;
  warnings?: string[];
};

type RunCheckResponse = {
  blood?: BloodResult;
  warnings?: string[];
  error?: string;
};

export default function PillarBloodPage() {
  const [imageBase64, setImageBase64] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [result, setResult] = useState<BloodResult | null>(null);
  const [workflowWarnings, setWorkflowWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToDataUrl(file);
    setImageBase64(dataUrl);
    setPreviewUrl(dataUrl);
    setResult(null);
    setWorkflowWarnings([]);
    setError(null);
  }

  async function runBloodCheck() {
    if (!imageBase64) {
      setError("Upload a clear inner-eye image first.");
      return;
    }

    if (imageBase64.length < 100) {
      setError(`Image too small (${imageBase64.length} chars). Upload a larger image file.`);
      return;
    }

    setLoading(true);
    setError(null);
    setWorkflowWarnings([]);

    try {
      const res = await fetch("/api/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalText: "blood screening",
          baselineMap: 90,
          useCamera: false,
          simulateSpoof: false,
          bloodImageBase64: imageBase64,
        }),
      });

      const data = (await res.json()) as RunCheckResponse;
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setResult(null);
        return;
      }

      if (!data.blood) {
        setError("Blood result was not returned by the backend.");
        setResult(null);
        return;
      }

      setResult(data.blood);
      setWorkflowWarnings(data.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blood check failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const confidencePct = useMemo(() => {
    if (!result) return "-";
    return `${Math.round(result.confidence * 100)}%`;
  }, [result]);

  return (
    <div style={{ background: "var(--bg-gradient)", minHeight: "100vh" }}>
      <Navbar />
      <main className="container" style={{ padding: "40px 20px 100px" }}>
        <div className="animate-slide-up" style={{ marginBottom: 40, maxWidth: 820 }}>
          <div className="tag" style={{ marginBottom: 16, background: "rgba(239,68,68,0.12)", color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}>
            🩸 Modality IV - Blood Health
          </div>
          <h1>Conjunctiva Hemoglobin Estimate</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 720 }}>
            Upload a clear inner-eyelid photo to estimate hemoglobin and anemia risk band using the blood microservice.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: "start", gap: 28 }}>
          <div className="glass-card" style={{ padding: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Image Capture Input</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 18 }}>
              Use bright, uniform lighting and keep the inner conjunctiva region in focus.
            </p>
            <input type="file" accept="image/*" onChange={(event) => void onFileChange(event)} />

            {previewUrl && (
              <div style={{ marginTop: 16, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                <img src={previewUrl} alt="Conjunctiva preview" style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 320 }} />
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 18 }}
              onClick={() => void runBloodCheck()}
              disabled={loading}
            >
              {loading ? <><span className="spinner spinner-dark" /> Running Blood Check...</> : "Run Blood Check"}
            </button>

            {error && <div className="disclaimer" style={{ marginTop: 14 }}>⚠ {error}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {result ? (
              <>
                <div className="glass-card" style={{ padding: 28, display: "flex", justifyContent: "center" }}>
                  <RiskBadge
                    risk={result.risk_band}
                    score={result.risk_band === "high" ? 0.85 : result.risk_band === "medium" ? 0.55 : 0.2}
                    size="lg"
                    label="Blood Risk"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <MetricCard icon="🩸" label="Hemoglobin" value={result.hemoglobin_g_dl.toFixed(2)} unit="g/dL" accent="#ef4444" />
                  <MetricCard icon="🎯" label="Confidence" value={confidencePct} accent="var(--text-secondary)" />
                  <MetricCard icon="🧪" label="ROI Quality" value={`${Math.round(result.roi_quality * 100)}%`} accent="#0ea5e9" />
                  <MetricCard icon="⚙" label="Method" value={result.method} accent="var(--text-secondary)" />
                </div>

                {(result.warnings?.length ?? 0) > 0 && (
                  <div className="glass-card" style={{ padding: 20 }}>
                    <div className="label" style={{ marginBottom: 8 }}>Service Warnings</div>
                    {result.warnings?.map((warning, index) => (
                      <div key={index} className="text-sm text-muted" style={{ marginBottom: 6 }}>• {warning}</div>
                    ))}
                  </div>
                )}

                {workflowWarnings.length > 0 && (
                  <div className="disclaimer">
                    {workflowWarnings.join(" ")}
                  </div>
                )}
              </>
            ) : (
              <div className="glass-card" style={{ padding: 50, textAlign: "center", border: "1px dashed var(--border-subtle)" }}>
                <div style={{ fontSize: "3rem", marginBottom: 14 }}>🩸</div>
                <h3 style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Awaiting Image</h3>
                <p style={{ color: "var(--text-muted)", margin: 0 }}>Upload an eye image and run analysis to see blood metrics.</p>
              </div>
            )}
          </div>
        </div>
      </main>
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
