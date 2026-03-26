"use client";

interface RiskBadgeProps {
  risk?: string;
  score?: number; // 0–1
  label?: string;
  size?: "sm" | "md" | "lg";
}

function riskColor(risk?: string): string {
  if (risk === "high") return "#ef4444";
  if (risk === "medium") return "#f59e0b";
  return "#22c55e";
}

function riskBgClass(risk?: string): string {
  if (risk === "high") return "risk-badge-high";
  if (risk === "medium") return "risk-badge-medium";
  if (risk === "low") return "risk-badge-low";
  return "";
}

export default function RiskBadge({ risk, score, label, size = "md" }: RiskBadgeProps) {
  const color = riskColor(risk);
  const displayRisk = risk ? risk.charAt(0).toUpperCase() + risk.slice(1) : "—";

  const ringSize = size === "lg" ? 120 : size === "md" ? 80 : 52;
  const strokeWidth = size === "lg" ? 8 : 6;
  const radius = (ringSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPct = score !== undefined ? Math.max(0, Math.min(score, 1)) : (risk === "high" ? 0.85 : risk === "medium" ? 0.55 : 0.25);
  const offset = circumference * (1 - fillPct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* SVG Ring */}
      <div style={{ position: "relative" }}>
        <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-ring"
            style={{
              filter: `drop-shadow(0 0 4px ${color}44)`,
            }}
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {score !== undefined && (
            <span style={{ fontSize: size === "lg" ? "1.6rem" : "1.1rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "Outfit, sans-serif", letterSpacing: "-0.05em" }}>
              {Math.round(fillPct * 100)}
            </span>
          )}
        </div>
      </div>

      {/* Risk label pill */}
      {risk && (
        <span className={`risk-badge ${riskBgClass(risk)}`}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
          {label ? `${label}: ` : ""}{displayRisk}
        </span>
      )}
    </div>
  );
}
