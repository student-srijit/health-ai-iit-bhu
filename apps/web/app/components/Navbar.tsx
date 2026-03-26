"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/pillar-depression", label: "Mental" },
  { href: "/pillar-ppg", label: "Vitals" },
  { href: "/pillar-blood", label: "Blood" },
  { href: "/pillar-nervous", label: "Nervous" },
  { href: "/pillar-orchestrator", label: "LLM" },
];

type ServiceStatus = "ok" | "down" | "unchecked";

interface NavbarProps {
  serviceStatus?: Record<string, ServiceStatus>;
}

export default function Navbar({ serviceStatus = {} }: NavbarProps) {
  const pathname = usePathname();

  const allOk = Object.values(serviceStatus).length > 0 && Object.values(serviceStatus).every((s) => s === "ok");
  const anyDown = Object.values(serviceStatus).some((s) => s === "down");

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(9,31,24,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(107,139,121,0.12)",
      padding: "0 40px",
    }}>
      <div style={{
        maxWidth: 1400, margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 68, gap: 24,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path d="M16 4 L28 12 L28 24 L16 28 L4 24 L4 12 Z" stroke="#EBF5DF" strokeWidth="1.5" fill="none" />
            <path d="M16 10 L22 14 L22 22 L16 25 L10 22 L10 14 Z" stroke="#EBF5DF" strokeWidth="1" fill="rgba(235,245,223,0.05)" />
          </svg>
          <span style={{
            fontSize: "1rem", fontWeight: 700, color: "#F4F8EC",
            fontFamily: "var(--font-display)", letterSpacing: "-0.02em",
          }}>
            KinetiCare
          </span>
        </Link>

        {/* Links */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "7px 16px",
                  borderRadius: 999,
                  textDecoration: "none",
                  fontSize: "0.825rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "#F4F8EC" : "#6B8B79",
                  background: active ? "rgba(235,245,223,0.07)" : "transparent",
                  border: active ? "1px solid rgba(235,245,223,0.12)" : "1px solid transparent",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.02em",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Status + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {Object.values(serviceStatus).length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 999,
              background: "rgba(107,139,121,0.08)",
              border: "1px solid rgba(107,139,121,0.15)",
            }}>
              <div className={`status-dot ${allOk ? "status-dot-ok" : anyDown ? "status-dot-err" : "status-dot-idle"}`} />
              <span style={{ fontSize: "0.75rem", color: "#6B8B79", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
                {allOk ? "Nominal" : anyDown ? "Disruption" : "Unknown"}
              </span>
            </div>
          )}
          <Link href="/daily-checkup" className="btn btn-primary btn-sm">
            Begin Checkup
          </Link>
        </div>
      </div>
    </nav>
  );
}
