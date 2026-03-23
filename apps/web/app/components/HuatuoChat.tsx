"use client";

import { useEffect, useRef, useState } from "react";

interface HuatuoChatProps {
  prompt?: string;
  autoRun?: boolean;
  summary?: string;
  modelUsed?: string;
  llmResponse?: string;
}

export default function HuatuoChat({ prompt, autoRun = false, summary, modelUsed, llmResponse }: HuatuoChatProps) {
  const [displayed, setDisplayed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(llmResponse ?? null);
  const [usedModel, setUsedModel] = useState<string | null>(modelUsed ?? null);
  const typeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runTypewriter = (text: string) => {
    setDisplayed("");
    let i = 0;
    const cleaned = text.replace(/\r\n/g, "\n");
    typeRef.current = setInterval(() => {
      i += 3;
      setDisplayed(cleaned.slice(0, i));
      if (i >= cleaned.length) {
        clearInterval(typeRef.current!);
        setDisplayed(cleaned);
      }
    }, 20);
  };

  useEffect(() => {
    if (llmResponse) {
      setRawResponse(llmResponse);
      runTypewriter(llmResponse);
    }
    return () => { if (typeRef.current) clearInterval(typeRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmResponse]);

  useEffect(() => {
    if (autoRun && prompt && !rawResponse) {
      void askHuatuo();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, prompt]);

  async function askHuatuo() {
    if (!prompt) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/huatuo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json() as { reasoning: string; model_used: string; confidence: string };
      setRawResponse(data.reasoning);
      setUsedModel(data.model_used);
      runTypewriter(data.reasoning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "HuatuoGPT call failed");
    } finally {
      setLoading(false);
    }
  }

  const isFallback = usedModel?.includes("fallback");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8, padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent-teal), #14b8a6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              flexShrink: 0,
              boxShadow: "0 8px 16px rgba(13, 148, 136, 0.2)",
            }}
          >
            🧠
          </div>
          <div>
            <div style={{ fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--text-primary)", fontSize: "1.1rem" }}>HuatuoGPT-o1</div>
            <div className="text-xs text-muted" style={{ fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Clinical Reasoning Engine</div>
          </div>
        </div>
        {usedModel && (
          <span className="tag" style={{ background: isFallback ? "#fef3c7" : "#f0fdfa", color: isFallback ? "#d97706" : "var(--accent-teal)", borderColor: isFallback ? "#fde68a" : "#ccfbf1" }}>
            {isFallback ? "⚠ Default Protocol" : "✓ Active Inference"}
          </span>
        )}
      </div>

      {/* Disclaimer */}
      <div className="disclaimer" style={{ margin: "0 24px 16px", background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
        <span className="disclaimer-icon">⚕</span> This reasoning trace is for <strong>clinical decision support only</strong> and requires physician review.
      </div>

      {/* Summary context (if provided) */}
      {summary && (
        <div className="chat-bubble chat-bubble-system" style={{ margin: "0 24px 16px", fontSize: "0.9rem" }}>
          <div className="label" style={{ marginBottom: 6, color: "var(--text-secondary)" }}>Patient Vector Summary</div>
          <p style={{ margin: 0, color: "var(--text-primary)" }}>{summary}</p>
        </div>
      )}

      {/* AI Response */}
      <div
        className="chat-bubble chat-bubble-ai"
        style={{
          minHeight: 140,
          margin: "0 24px 24px",
          fontSize: "0.95rem",
          fontWeight: 500,
          lineHeight: 1.8,
          whiteSpace: "pre-wrap",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-secondary)" }}>
            <span className="spinner spinner-dark" />
            Synthesizing Differential...
          </div>
        ) : displayed ? (
          <>
            {displayed}
            {displayed !== rawResponse && <span className="cursor" style={{ color: "var(--accent-teal)" }}>▍</span>}
          </>
        ) : (
          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
            {error ?? "Awaiting inference trigger to generate clinical rationale."}
          </span>
        )}
      </div>

      {/* Action button */}
      {!loading && prompt && (
        <div style={{ padding: "0 24px 24px" }}>
          <button
            className="btn btn-secondary"
            style={{ width: "100%" }}
            onClick={() => void askHuatuo()}
          >
            {rawResponse ? "🔄 Request Secondary Opinion" : "🧠 Initiate Inference Trace"}
          </button>
        </div>
      )}

      {error && (
        <div className="disclaimer" style={{ margin: "0 24px 24px" }}>
          <span className="disclaimer-icon">⚠</span> {error}
        </div>
      )}
    </div>
  );
}
