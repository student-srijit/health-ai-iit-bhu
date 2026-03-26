"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

// ─────────────────────────────────────────
//  Types
// ─────────────────────────────────────────
type HealthResponse = Record<string, { ok: boolean; message: string }>;

// ─────────────────────────────────────────
//  useScrollReveal hook
// ─────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ─────────────────────────────────────────
//  Reveal wrapper
// ─────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.85s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.85s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
//  Data
// ─────────────────────────────────────────
const PILLARS = [
  {
    href: "/pillar-depression",
    title: "Digital Phenotype",
    sub: "Mental Health",
    desc: "30-second keystroke analysis, NLP sentiment, and LSTM fusion provides a clinical-grade mental health snapshot — no questionnaires.",
    accent: "#2DD4BF",
    num: "01",
  },
  {
    href: "/pillar-ppg",
    title: "rPPG Vitals",
    sub: "Cardiovascular",
    desc: "Camera-based photoplethysmography estimates your heart rate and MAP change. No cuff, no hardware — just your phone.",
    accent: "#F472B6",
    num: "02",
  },
  {
    href: "/pillar-blood",
    title: "Conjunctiva Hb",
    sub: "Blood Health",
    desc: "A photograph of your lower eyelid is analyzed by a CNN to estimate hemoglobin levels and anemia risk band.",
    accent: "#E14B4B",
    num: "03",
  },
  {
    href: "/pillar-nervous",
    title: "Neuromotor Signals",
    sub: "Nervous System",
    desc: "Tap cadence, tremor dynamics, and inter-tap intervals map fine-motor neural pathways for early anomaly detection.",
    accent: "#60A5FA",
    num: "04",
  },
  {
    href: "/pillar-orchestrator",
    title: "HuatuoGPT-o1",
    sub: "Medical LLM",
    desc: "A specialized medical AI fuses all five pillar outputs into a single, verifiable clinical synthesis report in plain language.",
    accent: "#A78BFA",
    num: "05",
  },
];

const HOW_STEPS = [
  {
    step: "1",
    title: "Open KinetiCare",
    desc: "No app download required. Open on any phone browser and grant camera permission.",
  },
  {
    step: "2",
    title: "Complete a 2-Minute Checkup",
    desc: "Journal your day, hold your phone up, tap the screen. Five intelligent sensors run silently.",
  },
  {
    step: "3",
    title: "Receive Your Report",
    desc: "Instantly get a clinician-grade synthesis report with risk levels, trends, and AI-generated health insights.",
  },
  {
    step: "4",
    title: "Share with Your Doctor",
    desc: "Export a structured PDF your clinician can use to prioritize triage, saving hospital time and cutting costs.",
  },
];

const FAQS = [
  {
    q: "Is this medically certified?",
    a: "KinetiCare is a clinical decision-support tool designed for pre-screening and research. It does not replace a formal medical diagnosis, but provides structured signals that clinicians can use to prioritize care.",
  },
  {
    q: "How accurate is the rPPG heart rate measurement?",
    a: "Our hybrid CNN-GRU model achieves MAE <4 BPM on the UBFC-rPPG benchmark under standard lighting conditions. Accuracy varies with lighting and motion.",
  },
  {
    q: "Is my health data stored?",
    a: "All processing happens on-device for camera and tap signals. Only de-identified model outputs are optionally synced to MongoDB for your own longitudinal history. No raw video or images are ever stored.",
  },
  {
    q: "What devices does it support?",
    a: "Any modern smartphone or laptop with a camera and browser (Chrome 90+, Safari 15+). No app install needed — it's a Progressive Web App.",
  },
  {
    q: "Who is this built for?",
    a: "KinetiCare targets under-resourced clinical environments, community health workers, and remote patient monitoring programs where full diagnostic equipment is unavailable.",
  },
];

const STATS = [
  { value: "5", unit: "Pillars", label: "Independently analyzed health signals" },
  { value: "<2", unit: "Min", label: "Average full checkup duration" },
  { value: "94%", unit: "Acc.", label: "Depression risk classification accuracy" },
  { value: "∞", unit: "Access", label: "No hardware, wearables, or app installs" },
];

// ─────────────────────────────────────────
//  Main
// ─────────────────────────────────────────
export default function Home() {
  const [serviceStatus, setServiceStatus] = useState<HealthResponse>({});
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Service health polling
  useEffect(() => {
    fetch("/api/health-all")
      .then((r) => r.json())
      .then(setServiceStatus)
      .catch(() => {});
  }, []);

  // Parallax hero image
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const offset = window.scrollY * 0.3;
        heroRef.current.style.transform = `translateY(${offset}px)`;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const allOk =
    Object.values(serviceStatus).length > 0 &&
    Object.values(serviceStatus).every((s) => s.ok);

  return (
    <div style={{ background: "#FAFBFC", color: "#111827", fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(250, 251, 252, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "0 48px",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 70 }}>
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Custom geometric mark — no AI emoji */}
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <rect x="1" y="9" width="13" height="13" rx="2" stroke="#0F4C5C" strokeWidth="1.5" fill="none" />
              <rect x="16" y="1" width="13" height="13" rx="2" stroke="#0F4C5C" strokeWidth="1.5" fill="none" />
              <rect x="16" y="17" width="13" height="13" rx="2" stroke="#0F4C5C" strokeWidth="1.5" fill="#0F4C5C" fillOpacity="0.08" />
              <line x1="14" y1="15.5" x2="16" y2="15.5" stroke="#0F4C5C" strokeWidth="1.5" />
              <line x1="22.5" y1="14" x2="22.5" y2="17" stroke="#0F4C5C" strokeWidth="1.5" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.02em", color: "#0F4C5C" }}>
              KinetiCare
            </span>
          </div>
          {/* Links */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[
              { href: "#pillars", l: "AI Pillars" },
              { href: "#how", l: "How It Works" },
              { href: "#faq", l: "FAQ" },
              { href: "/clinician", l: "Clinicians" },
            ].map(({ href, l }) => (
              <a key={href} href={href} style={{
                padding: "8px 16px",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#4B5563",
                textDecoration: "none",
                borderRadius: 99,
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = "#0F4C5C"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4B5563"; }}
              >
                {l}
              </a>
            ))}
          </div>
          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#F3F4F6", borderRadius: 99, border: "1px solid #E5E7EB" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: allOk ? "#22C55E" : "#94A3B8", boxShadow: allOk ? "0 0 6px #22C55E80" : "none" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", letterSpacing: "0.04em" }}>
                {allOk ? "All Systems Live" : "Checking…"}
              </span>
            </div>
            <Link href="/daily-checkup" style={{
              padding: "10px 22px",
              background: "#0F4C5C",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 99,
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
              transition: "all 0.25s",
              boxShadow: "0 4px 14px rgba(15,76,92,0.25)",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(15,76,92,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,76,92,0.25)"; }}
            >
              Begin Checkup <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        padding: "0 48px",
        paddingTop: 100,
        maxWidth: 1280,
        margin: "0 auto",
      }}>
        {/* Left text */}
        <div style={{ flex: "0 0 52%", paddingRight: 64 }}>
          <div style={{ overflow: "hidden" }}>
            <p style={{
              fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em",
              color: "#0F4C5C", textTransform: "uppercase",
              opacity: 1, transform: "translateY(0)",
              transition: "all 0.8s cubic-bezier(0.22,1,0.36,1) 0ms",
              marginBottom: 24,
            }}>
              AI-Powered Clinical Intelligence
            </p>
          </div>
          <h1 style={{
            fontSize: "clamp(2.6rem, 5vw, 4rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            color: "#0A1628",
            marginBottom: 28,
            animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 0ms both",
          }}>
            Your Body&apos;s Data,<br />
            <span style={{ color: "#0F4C5C" }}>Decoded in Minutes.</span>
          </h1>
          <p style={{
            fontSize: "1.1rem",
            lineHeight: 1.75,
            color: "#4B5563",
            maxWidth: 460,
            marginBottom: 44,
            animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 150ms both",
          }}>
            KinetiCare is a zero-hardware medical AI platform. Using your phone&apos;s camera, keyboard, and screen, it delivers a clinical-grade health synthesis — in under 2 minutes.
          </p>
          <div style={{ display: "flex", gap: 14, animation: "fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 300ms both" }}>
            <Link href="/daily-checkup" style={{
              padding: "16px 36px",
              background: "#0F4C5C",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 99,
              fontSize: "1rem",
              fontWeight: 700,
              display: "flex", alignItems: "center", gap: 10,
              boxShadow: "0 4px 20px rgba(15,76,92,0.3)",
              transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(15,76,92,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(15,76,92,0.3)"; }}
            >
              Start Free Checkup <ArrowRight size={16} />
            </Link>
            <Link href="/clinician" style={{
              padding: "16px 36px",
              border: "1.5px solid #D1D5DB",
              color: "#374151",
              textDecoration: "none",
              borderRadius: 99,
              fontSize: "1rem",
              fontWeight: 600,
              transition: "all 0.25s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#0F4C5C"; e.currentTarget.style.color = "#0F4C5C"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = "#374151"; }}
            >
              For Clinicians
            </Link>
          </div>

          {/* Mini trust bar */}
          <div style={{ display: "flex", gap: 32, marginTop: 56 }}>
            {["Zero Hardware", "100% Private", "Clinician Ready"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0F4C5C" }} />
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#6B7280" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right visual — custom abstract biodata display */}
        <div ref={heroRef} style={{ flex: "0 0 48%", position: "relative", animation: "slideInRight 1s cubic-bezier(0.22,1,0.36,1) 200ms both" }}>
          {/* Glow */}
          <div style={{
            position: "absolute", inset: -60, background: "radial-gradient(circle at 60% 40%, rgba(15,76,92,0.08) 0%, transparent 70%)",
            borderRadius: "50%", filter: "blur(40px)", zIndex: 0,
          }} />
          {/* Custom UI panel — not an AI SVG */}
          <div style={{
            position: "relative", zIndex: 1,
            background: "#fff",
            borderRadius: 28,
            border: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
            padding: 36,
            overflow: "hidden",
          }}>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <div>
                <p style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Clinical Report</p>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0A1628", margin: 0 }}>Anubhab R. · Today</h3>
              </div>
              <div style={{ padding: "6px 14px", background: "rgba(34,197,94,0.08)", borderRadius: 99, border: "1px solid rgba(34,197,94,0.2)" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16A34A", letterSpacing: "0.06em" }}>LOW RISK</span>
              </div>
            </div>
            {/* Pillar bars */}
            {[
              { l: "Mental Health", pct: 82, c: "#2DD4BF" },
              { l: "Cardiovascular", pct: 91, c: "#F472B6" },
              { l: "Blood Health", pct: 74, c: "#E14B4B" },
              { l: "Neuromotor", pct: 88, c: "#60A5FA" },
              { l: "AI Synthesis", pct: 86, c: "#A78BFA" },
            ].map(({ l, pct, c }) => (
              <div key={l} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: "0.8rem", color: "#374151", fontWeight: 500 }}>{l}</span>
                  <span style={{ fontSize: "0.8rem", color: "#6B7280", fontFamily: "monospace" }}>{pct}</span>
                </div>
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: `linear-gradient(90deg, ${c}cc, ${c})`,
                    borderRadius: 99,
                    transition: "width 1.4s cubic-bezier(0.22,1,0.36,1)",
                  }} />
                </div>
              </div>
            ))}
            {/* Bottom summary */}
            <div style={{ marginTop: 28, padding: "18px 20px", background: "#F8FAFC", borderRadius: 16, border: "1px solid #E5E7EB" }}>
              <p style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>AI Clinical Summary</p>
              <p style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.6, margin: 0 }}>
                Biometric patterns indicate a stable physiological baseline with no acute neurological or cardiovascular anomalies detected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS
      ══════════════════════════════════════════ */}
      <section style={{ background: "#0F4C5C", padding: "72px 48px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
          {STATS.map(({ value, unit, label }, i) => (
            <Reveal key={label} delay={i * 120}>
              <div style={{ padding: "32px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {value}<span style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", marginLeft: 6, fontWeight: 500 }}>{unit}</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", marginTop: 10, fontWeight: 500 }}>{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PILLARS
      ══════════════════════════════════════════ */}
      <section id="pillars" style={{ padding: "120px 48px", maxWidth: 1280, margin: "0 auto" }}>
        <Reveal>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", color: "#0F4C5C", textTransform: "uppercase", marginBottom: 16 }}>
            The Five Pillars
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#0A1628", marginBottom: 18 }}>
            One Checkup. Five Clinical Signals.
          </h2>
          <p style={{ fontSize: "1rem", color: "#6B7280", maxWidth: 560, lineHeight: 1.7 }}>
            Each pillar is an independent ML model fine-tuned on clinical data. The outputs are then fused by a specialized medical LLM.
          </p>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginTop: 64 }}>
          {PILLARS.map(({ href, title, sub, desc, accent, num }, i) => (
            <Reveal key={num} delay={i * 110}>
              <Link href={href} style={{ textDecoration: "none", display: "block" }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 20,
                    border: "1px solid #E5E7EB",
                    padding: "36px 32px",
                    transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    el.style.transform = "translateY(-6px)";
                    el.style.boxShadow = "0 20px 48px rgba(0,0,0,0.1)";
                    el.style.borderColor = accent;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    el.style.transform = "";
                    el.style.boxShadow = "";
                    el.style.borderColor = "#E5E7EB";
                  }}
                >
                  {/* Accent top bar */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, opacity: 0.7 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    {/* Pillar number */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 14,
                      background: `${accent}12`,
                      border: `1px solid ${accent}25`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: accent,
                    }}>
                      {num}
                    </div>
                    <ArrowRight size={16} style={{ color: "#D1D5DB", transition: "all 0.25s" }} />
                  </div>
                  <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>{sub}</p>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0A1628", letterSpacing: "-0.02em", marginBottom: 14 }}>{title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.7 }}>{desc}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section id="how" style={{ background: "#F5F7FA", padding: "120px 48px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Reveal>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", color: "#0F4C5C", textTransform: "uppercase", marginBottom: 16 }}>How It Works</p>
            <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#0A1628" }}>
              From Your Phone to a Clinical Report
            </h2>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, marginTop: 72 }}>
            {HOW_STEPS.map(({ step, title, desc }, i) => (
              <Reveal key={step} delay={i * 130}>
                <div style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: "36px 28px",
                  border: "1px solid #E5E7EB",
                  transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 16,
                    background: "#0F4C5C",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "1rem", color: "#fff",
                    marginBottom: 24,
                  }}>
                    {step}
                  </div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0A1628", letterSpacing: "-0.02em", marginBottom: 12 }}>{title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.7 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TECHNOLOGY – HORIZONTAL MARQUEE
      ══════════════════════════════════════════ */}
      <section style={{ padding: "80px 0", overflow: "hidden", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
        <div style={{
          display: "flex", gap: 64,
          animation: "marquee 25s linear infinite",
          whiteSpace: "nowrap",
        }}>
          {[
            "CNN-GRU · rPPG", "HuatuoGPT-o1", "LSTM Phenotyping", "MongoDB Atlas", "Next.js 14", "FastAPI", "PyTorch", "Framer Motion", "Conjunctiva Analysis", "Tremor Dynamics", "WebPPG", "IMU Keystroke Fusion",
            "CNN-GRU · rPPG", "HuatuoGPT-o1", "LSTM Phenotyping", "MongoDB Atlas", "Next.js 14", "FastAPI", "PyTorch", "Framer Motion", "Conjunctiva Analysis", "Tremor Dynamics", "WebPPG", "IMU Keystroke Fusion",
          ].map((item, i) => (
            <span key={i} style={{ fontSize: "0.875rem", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      <section id="faq" style={{ padding: "120px 48px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <Reveal>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", color: "#0F4C5C", textTransform: "uppercase", marginBottom: 16 }}>FAQ</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#0A1628", marginBottom: 56 }}>
              Common Questions
            </h2>
          </Reveal>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map(({ q, a }, i) => (
              <Reveal key={i} delay={i * 80}>
                <div style={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  overflow: "hidden",
                  transition: "box-shadow 0.25s",
                }}
                onMouseEnter={e => { if (openFaq !== i) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{
                      width: "100%",
                      padding: "22px 28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      gap: 16,
                    }}
                  >
                    <span style={{ fontSize: "1rem", fontWeight: 600, color: "#0A1628", lineHeight: 1.4 }}>{q}</span>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: openFaq === i ? "#0F4C5C" : "#F3F4F6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      transition: "background 0.25s",
                    }}>
                      {openFaq === i
                        ? <ChevronUp size={16} style={{ color: "#fff" }} />
                        : <ChevronDown size={16} style={{ color: "#6B7280" }} />
                      }
                    </div>
                  </button>
                  <div style={{
                    maxHeight: openFaq === i ? 300 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.4s cubic-bezier(0.22,1,0.36,1)",
                  }}>
                    <p style={{ padding: "0 28px 24px", fontSize: "0.9rem", color: "#6B7280", lineHeight: 1.75 }}>{a}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════ */}
      <section style={{ padding: "0 48px", paddingBottom: 120 }}>
        <Reveal>
          <div style={{
            maxWidth: 1280, margin: "0 auto",
            background: "linear-gradient(135deg, #0F4C5C 0%, #1a6b7e 100%)",
            borderRadius: 28,
            padding: "80px 80px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 40,
            boxShadow: "0 24px 80px rgba(15,76,92,0.25)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Subtle grid pattern */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 16 }}>
                Ready to Start?
              </p>
              <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: 16 }}>
                Your first checkup takes under 2 minutes.
              </h2>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", maxWidth: 480, lineHeight: 1.7 }}>
                No downloads, no wearables, no waiting rooms. KinetiCare assesses five clinical pillars using your existing smartphone.
              </p>
            </div>
            <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", gap: 12 }}>
              <Link href="/daily-checkup" style={{
                padding: "18px 40px",
                background: "#fff",
                color: "#0F4C5C",
                textDecoration: "none",
                borderRadius: 99,
                fontSize: "1rem",
                fontWeight: 700,
                display: "flex", alignItems: "center", gap: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
              >
                Begin Free Checkup <ArrowRight size={16} />
              </Link>
              <Link href="/clinician" style={{
                padding: "18px 36px",
                border: "1.5px solid rgba(255,255,255,0.25)",
                color: "#fff",
                textDecoration: "none",
                borderRadius: 99,
                fontSize: "1rem",
                fontWeight: 600,
                transition: "all 0.25s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.background = "transparent"; }}
              >
                Clinician Portal
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer style={{ borderTop: "1px solid #E5E7EB", padding: "56px 48px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
              <rect x="1" y="9" width="13" height="13" rx="2" stroke="#0F4C5C" strokeWidth="1.5" fill="none" />
              <rect x="16" y="1" width="13" height="13" rx="2" stroke="#0F4C5C" strokeWidth="1.5" fill="none" />
              <rect x="16" y="17" width="13" height="13" rx="2" stroke="#0F4C5C" strokeWidth="1.5" fill="#0F4C5C" fillOpacity="0.08" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0F4C5C", letterSpacing: "-0.01em" }}>KinetiCare</span>
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            {[["Privacy Policy", "#"], ["Documentation", "#"], ["Clinical Validation", "#"]].map(([l, h]) => (
              <a key={l} href={h} style={{ fontSize: "0.825rem", color: "#9CA3AF", textDecoration: "none", fontWeight: 500 }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>
            © 2026 KinetiCare · IIT BHU Hackathon
          </p>
        </div>
      </footer>

      {/* Global keyframe animations */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
