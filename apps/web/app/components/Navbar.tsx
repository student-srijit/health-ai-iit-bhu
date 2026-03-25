"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Dashboard", icon: "🏥" },
  { href: "/pillar-depression", label: "Mental Health", icon: "🧠" },
  { href: "/pillar-ppg", label: "Cardiovascular", icon: "💓" },
  { href: "/pillar-blood", label: "Blood Health", icon: "🩸" },
  { href: "/pillar-nervous", label: "Nervous System", icon: "🖐" },
  { href: "/pillar-orchestrator", label: "Medical Brain", icon: "🤖" },
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
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 72,
          gap: 24,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent-teal), #14b8a6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: "#fff",
              boxShadow: "0 8px 16px rgba(13, 148, 136, 0.25)",
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Aura Health
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
              Clinical Intelligence
            </div>
          </div>
        </Link>

        {/* Desktop nav links */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 999,
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  fontWeight: active ? 700 : 600,
                  color: active ? "var(--accent-teal)" : "var(--text-secondary)",
                  background: active ? "rgba(13, 148, 136, 0.08)" : "transparent",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Service status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "#f8fafc", padding: "6px 14px", borderRadius: 999, border: "1px solid #e2e8f0" }}>
          <div
            className={allOk ? "status-dot status-dot-ok" : anyDown ? "status-dot status-dot-err" : "status-dot status-dot-idle"}
          />
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            {allOk ? "Systems Nominal" : anyDown ? "Service Disruption" : "Awaiting Telemetry"}
          </span>
        </div>
      </div>
    </nav>
  );
}
