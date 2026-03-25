"use client";

import { PointerEvent, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import RiskBadge from "../components/RiskBadge";
import MetricCard from "../components/MetricCard";

type TapPoint = {
  x: number;
  y: number;
  t: number;
};

type NervousResult = {
  patient_id: string;
  risk_band: string;
  session_quality: string;
  confidence: number;
  tap_rate_hz: number;
  tremor_hz: number;
  amplitude_dropoff: number;
  metrics?: Record<string, number>;
};

type RunCheckResponse = {
  nervous?: NervousResult;
  warnings?: string[];
  error?: string;
};

export default function PillarNervousPage() {
  const [tapPoints, setTapPoints] = useState<TapPoint[]>([]);
  const [result, setResult] = useState<NervousResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derived = useMemo(() => deriveTapMetrics(tapPoints), [tapPoints]);

  function onTap(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point: TapPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: performance.now(),
    };
    setTapPoints((prev) => [...prev, point]);
  }

  function resetSession() {
    setTapPoints([]);
    setResult(null);
    setWarnings([]);
    setError(null);
  }

  async function runNervousCheck() {
    if (derived.tapIntervalsMs.length < 10 || derived.tapDistancesPx.length < 10) {
      setError("Record at least 11 taps before running analysis.");
      return;
    }

    const samplingRateHz = 30;
    const tremorSignal = synthesizeTremorSignal(derived.tapIntervalsMs, derived.tapDistancesPx, 128, samplingRateHz);

    setLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const res = await fetch("/api/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalText: "nervous screening",
          baselineMap: 90,
          useCamera: false,
          simulateSpoof: false,
          nervousTapIntervalsMs: derived.tapIntervalsMs,
          nervousTapDistancesPx: derived.tapDistancesPx,
          nervousTremorSignal: tremorSignal,
          nervousSamplingRateHz: samplingRateHz,
        }),
      });

      const data = (await res.json()) as RunCheckResponse;
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setResult(null);
        return;
      }

      if (!data.nervous) {
        setError("Nervous result was not returned by the backend.");
        setResult(null);
        return;
      }

      setResult(data.nervous);
      setWarnings(data.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nervous check failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-gradient)", minHeight: "100vh" }}>
      <Navbar />
      <main className="container" style={{ padding: "40px 20px 100px" }}>
        <div className="animate-slide-up" style={{ marginBottom: 36, maxWidth: 820 }}>
          <div className="tag" style={{ marginBottom: 16, background: "rgba(14,165,233,0.12)", color: "#0ea5e9", borderColor: "rgba(14,165,233,0.2)" }}>
            🖐 Modality V - Nervous System
          </div>
          <h1>Neuromotor Tapping Session</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 740 }}>
            Tap repeatedly inside the target pad. The page derives interval and distance patterns to score neuromotor consistency.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: "start", gap: 28 }}>
          <div className="glass-card" style={{ padding: 28 }}>
            <h3 style={{ marginBottom: 10 }}>Tap Capture</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              Record at least 11 taps. Try maintaining a steady rhythm for best quality.
            </p>

            <button
              type="button"
              onPointerDown={onTap}
              style={{
                width: "100%",
                minHeight: 220,
                borderRadius: 14,
                border: "2px dashed rgba(14,165,233,0.45)",
                background: "linear-gradient(145deg, rgba(14,165,233,0.10), rgba(20,184,166,0.06))",
                color: "var(--text-primary)",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              TAP HERE ({tapPoints.length} taps)
            </button>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={resetSession} style={{ flex: 1 }}>
                Reset Session
              </button>
              <button className="btn btn-primary" onClick={() => void runNervousCheck()} disabled={loading} style={{ flex: 1 }}>
                {loading ? <><span className="spinner spinner-dark" /> Running...</> : "Run Nervous Check"}
              </button>
            </div>

            {error && <div className="disclaimer" style={{ marginTop: 14 }}>⚠ {error}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="glass-card" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 10 }}>Captured Session Stats</div>
              <div className="text-sm" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>Intervals: <strong>{derived.tapIntervalsMs.length}</strong></div>
                <div>Distances: <strong>{derived.tapDistancesPx.length}</strong></div>
                <div>Mean Interval: <strong>{derived.meanIntervalMs.toFixed(1)} ms</strong></div>
                <div>Mean Distance: <strong>{derived.meanDistancePx.toFixed(1)} px</strong></div>
              </div>
            </div>

            {result ? (
              <>
                <div className="glass-card" style={{ padding: 26, display: "flex", justifyContent: "center" }}>
                  <RiskBadge
                    risk={result.risk_band}
                    score={result.risk_band === "high" ? 0.85 : result.risk_band === "medium" ? 0.55 : 0.2}
                    size="lg"
                    label="Nervous Risk"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <MetricCard icon="🎯" label="Confidence" value={`${Math.round(result.confidence * 100)}%`} accent="#0ea5e9" />
                  <MetricCard icon="⚙" label="Session Quality" value={result.session_quality} accent="var(--text-secondary)" />
                  <MetricCard icon="⏱" label="Tap Rate" value={result.tap_rate_hz.toFixed(2)} unit="Hz" accent="#14b8a6" />
                  <MetricCard icon="〰" label="Tremor Peak" value={result.tremor_hz.toFixed(2)} unit="Hz" accent="#f59e0b" />
                  <MetricCard icon="📉" label="Amplitude Dropoff" value={`${Math.round(result.amplitude_dropoff * 100)}%`} accent="#ef4444" />
                </div>

                {warnings.length > 0 && (
                  <div className="disclaimer">{warnings.join(" ")}</div>
                )}
              </>
            ) : (
              <div className="glass-card" style={{ padding: 48, textAlign: "center", border: "1px dashed var(--border-subtle)" }}>
                <div style={{ fontSize: "3rem", marginBottom: 14 }}>🖐</div>
                <h3 style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Awaiting Tapping Session</h3>
                <p style={{ color: "var(--text-muted)", margin: 0 }}>Capture taps, then run analysis to view nervous metrics.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function deriveTapMetrics(points: TapPoint[]): {
  tapIntervalsMs: number[];
  tapDistancesPx: number[];
  meanIntervalMs: number;
  meanDistancePx: number;
} {
  if (points.length < 2) {
    return { tapIntervalsMs: [], tapDistancesPx: [], meanIntervalMs: 0, meanDistancePx: 0 };
  }

  const tapIntervalsMs: number[] = [];
  const tapDistancesPx: number[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const dt = Math.max(1, cur.t - prev.t);
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.sqrt((dx * dx) + (dy * dy));

    tapIntervalsMs.push(Number(dt.toFixed(3)));
    tapDistancesPx.push(Number(dist.toFixed(3)));
  }

  const meanIntervalMs = tapIntervalsMs.reduce((acc, value) => acc + value, 0) / tapIntervalsMs.length;
  const meanDistancePx = tapDistancesPx.reduce((acc, value) => acc + value, 0) / tapDistancesPx.length;

  return { tapIntervalsMs, tapDistancesPx, meanIntervalMs, meanDistancePx };
}

function synthesizeTremorSignal(intervalsMs: number[], distancesPx: number[], size: number, samplingRateHz: number): number[] {
  if (intervalsMs.length === 0 || distancesPx.length === 0) {
    return new Array(size).fill(0);
  }

  const velocities = intervalsMs.map((ms, idx) => distancesPx[Math.min(idx, distancesPx.length - 1)] / Math.max(ms, 1));
  const velocityMean = velocities.reduce((acc, value) => acc + value, 0) / velocities.length;

  const centered = velocities.map((v) => v - velocityMean);
  const maxAbs = Math.max(...centered.map((v) => Math.abs(v)), 1e-6);
  const normalized = centered.map((v) => v / maxAbs);

  const meanInterval = intervalsMs.reduce((acc, value) => acc + value, 0) / intervalsMs.length;
  const tapRateHz = 1000 / Math.max(meanInterval, 1);
  const tremorFreqHz = Math.min(8, Math.max(3, tapRateHz * 0.9));

  return Array.from({ length: size }, (_, i) => {
    const sourceIdx = Math.floor((i / size) * normalized.length);
    const t = i / samplingRateHz;
    const oscillation = Math.sin(2 * Math.PI * tremorFreqHz * t);
    const carrier = normalized[Math.min(sourceIdx, normalized.length - 1)] ?? 0;
    return Number((0.65 * carrier + 0.35 * oscillation).toFixed(6));
  });
}
