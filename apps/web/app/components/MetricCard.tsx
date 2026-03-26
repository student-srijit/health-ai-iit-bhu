"use client";

interface MetricCardProps {
  icon?: string;
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  accent?: string;
  trend?: "up" | "down" | "stable" | null;
}

export default function MetricCard({ icon, label, value, unit, subtext, accent = "#14b8a6", trend }: MetricCardProps) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : trend === "stable" ? "→" : null;
  const trendColor = trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : "#94a3b8";

  return (
    <div
      className="glass-card"
      style={{ padding: "20px 24px", position: "relative", overflow: "hidden" }}
    >
      {/* Accent strip left */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          background: accent,
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            {icon && <span style={{ fontSize: "1.2rem" }}>{icon}</span>}
            <span className="label" style={{ color: "var(--text-secondary)" }}>{label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="metric-value" style={{ color: accent }}>
              {value}
            </span>
            {unit && <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>{unit}</span>}
          </div>
          {subtext && <div className="text-sm text-muted mt-2">{subtext}</div>}
        </div>
        {trendIcon && (
          <span style={{ fontSize: "1.4rem", fontWeight: 700, color: trendColor }}>{trendIcon}</span>
        )}
      </div>
    </div>
  );
}
