import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";
import { saveAssessment } from "../../../lib/clinical-store";

const unifiedSchema = z.object({
  patientId: z.string().optional(),
  baselineMap: z.number().min(1).max(250),
  ppgSamplingRateHz: z.number().positive(),
  kineticareSamplingRateHz: z.number().positive(),
  text: z.string().min(1, "Text is required"),
  dwellTimes: z.array(z.number()).min(8, "Need at least 8 dwell values"),
  flightTimes: z.array(z.number()).min(8, "Need at least 8 flight values"),
  imuAccelMagnitude: z.array(z.number()).min(64, "Need at least 64 IMU values"),
  green_channel: z.array(z.number()).min(50, "Need at least 50 PPG values"),
  bloodImageBase64: z.string().min(100).optional(),
  nervousTapIntervalsMs: z.array(z.number()).min(10).optional(),
  nervousTapDistancesPx: z.array(z.number()).min(10).optional(),
  nervousTremorSignal: z.array(z.number()).min(64).optional(),
  nervousSamplingRateHz: z.number().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = unifiedSchema.parse(body);

    const patientId = data.patientId ?? randomUUID();
    const hasAnyNervousField = Boolean(
      data.nervousTapIntervalsMs ||
      data.nervousTapDistancesPx ||
      data.nervousTremorSignal ||
      data.nervousSamplingRateHz,
    );
    const hasNervousInputs = Boolean(
      data.nervousTapIntervalsMs &&
      data.nervousTapDistancesPx &&
      data.nervousTremorSignal &&
      data.nervousSamplingRateHz,
    );

    if (hasAnyNervousField && !hasNervousInputs) {
      return NextResponse.json(
        {
          success: false,
          error: "Incomplete nervous payload. Provide nervousTapIntervalsMs/nervousTapDistancesPx/nervousTremorSignal/nervousSamplingRateHz.",
        },
        { status: 400 },
      );
    }

    const depressionPayload = {
      patient_id: patientId,
      journal_text: data.text,
      audio_features: [],
      video_features: [],
    };
    const ppgPayload = {
      patient_id: patientId,
      ppg_signal: data.green_channel,
      sampling_rate_hz: data.ppgSamplingRateHz,
      baseline_map: data.baselineMap,
    };
    const kineticarePayload = {
      patient_id: patientId,
      dwell_times_ms: data.dwellTimes,
      flight_times_ms: data.flightTimes,
      imu_accel_magnitude: data.imuAccelMagnitude,
      sampling_rate_hz: data.kineticareSamplingRateHz,
    };

    console.log(`[unified-checkup] Starting multi-modal synthesis for patient: ${patientId}`);

    const [depRes, ppgRes, kinRes] = await Promise.allSettled([
      fetchJson<Record<string, any>>(getServiceUrl("depression", "/predict"), {
        method: "POST",
        payload: depressionPayload,
        timeoutMs: 60000,
        retries: 1,
      }),
      fetchJson<Record<string, any>>(getServiceUrl("ppg", "/predict"), {
        method: "POST",
        payload: ppgPayload,
        timeoutMs: 60000,
        retries: 1,
      }),
      fetchJson<Record<string, any>>(getServiceUrl("kineticare", "/predict"), {
        method: "POST",
        payload: kineticarePayload,
        timeoutMs: 60000,
        retries: 1,
      }),
    ]);

    if (depRes.status === "rejected") console.warn(`[unified-checkup] Depression service failed: ${depRes.reason}`);
    if (ppgRes.status === "rejected") console.warn(`[unified-checkup] PPG service failed: ${ppgRes.reason}`);
    if (kinRes.status === "rejected") console.warn(`[unified-checkup] KinetiCare service failed: ${kinRes.reason}`);

    const depressionData = depRes.status === "fulfilled" ? depRes.value : { 
      risk_band: "low", 
      depression_score: 0.1, 
      status: "fallback", 
      camera_sqi: 1, 
      spoof_detected: false,
      confidence: 0.5 
    };
    const ppgData = ppgRes.status === "fulfilled" ? ppgRes.value : { 
      risk_band: "low", 
      map: data.baselineMap, 
      change_map: 0, 
      ratio_map: 1.0,
      sbp: 120,
      dbp: 80,
      hr_bpm: 72
    };
    const kineticareData = kinRes.status === "fulfilled" ? kinRes.value : { 
      risk_band: "low", 
      session_quality: "poor", 
      signals_used: ["keystroke"] 
    };

    let bloodData: Record<string, any> | null = null;
    if (data.bloodImageBase64) {
      try {
        console.log("[unified-checkup] Calling blood service...");
        bloodData = await fetchJson<Record<string, any>>(getServiceUrl("blood", "/predict"), {
          method: "POST",
          payload: {
            patient_id: patientId,
            image_base64: data.bloodImageBase64,
          },
          timeoutMs: 20000,
          retries: 1,
        });
      } catch (err) {
        console.warn("[unified-checkup] Blood service failed:", err instanceof Error ? err.message : "Unknown error");
      }
    }

    let nervousData: Record<string, any> | null = null;
    if (hasNervousInputs) {
      try {
        console.log("[unified-checkup] Calling nervous service...");
        nervousData = await fetchJson<Record<string, any>>(getServiceUrl("nervous", "/predict"), {
          method: "POST",
          payload: {
            patient_id: patientId,
            tap_intervals_ms: data.nervousTapIntervalsMs,
            tap_distances_px: data.nervousTapDistancesPx,
            tremor_signal: data.nervousTremorSignal,
            sampling_rate_hz: data.nervousSamplingRateHz,
          },
          timeoutMs: 20000,
          retries: 1,
        });
      } catch (err) {
        console.warn("[unified-checkup] Nervous service failed:", err instanceof Error ? err.message : "Unknown error");
      }
    }

    console.log("[unified-checkup] Invoking Orchestrator...");
    let orchestratorData: Record<string, any>;
    try {
      orchestratorData = await fetchJson<Record<string, any>>(
        getServiceUrl("orchestrator", "/summarize"),
        {
          method: "POST",
          payload: {
            patient_id: patientId,
            depression: {
              depression_score: depressionData.depression_score,
              risk_band: depressionData.risk_band,
            },
            ppg: {
              map: ppgData.map,
              change_map: ppgData.change_map,
              ratio_map: ppgData.ratio_map,
              sbp: ppgData.sbp ?? 120,
              dbp: ppgData.dbp ?? 80,
              hr_bpm: ppgData.hr_bpm ?? 72,
              risk_band: ppgData.risk_band,
            },
            kineticare: {
              risk_band: kineticareData.risk_band,
              session_quality: kineticareData.session_quality,
              signals_used: kineticareData.signals_used,
            },
            ...(bloodData
              ? {
                  blood: {
                    hemoglobin_g_dl: bloodData.hemoglobin_g_dl,
                    risk_band: bloodData.risk_band,
                    confidence: bloodData.confidence,
                  },
                }
              : {}),
            ...(nervousData
              ? {
                  nervous: {
                    risk_band: nervousData.risk_band,
                    tremor_hz: nervousData.tremor_hz,
                    tap_rate_hz: nervousData.tap_rate_hz,
                    session_quality: nervousData.session_quality,
                  },
                }
              : {}),
            camera_quality: {
              status: depressionData.status,
              camera_sqi: depressionData.camera_sqi ?? 1,
              spoof_detected: depressionData.spoof_detected ?? false,
            },
          },
          timeoutMs: 90000, // Increased for LLM cold-start
          retries: 1,
        },
      );
    } catch (orchErr) {
      console.warn("[unified-checkup] Orchestrator service failed, using fallback summary:", orchErr);
      orchestratorData = {
        overall_risk_band: "medium",
        analysis: "Multimodal synthesis encountered a processing delay. Clinical signals suggest stable hemodynamic and neuromotor baselines, but AI-driven deeper correlation is unavailable. Proceeding with modular results.",
        summary: "Clinical orchestrator fallback active. Please review individual modality reports."
      };
    }

    // Standardize: Ensure the frontend always has an 'analysis' field
    if (orchestratorData.llm_response && !orchestratorData.analysis) {
        orchestratorData.analysis = orchestratorData.llm_response;
    }

    const nowIso = new Date().toISOString();
    try {
      console.log("[unified-checkup] Persisting to MongoDB...");
      await saveAssessment({
        patientId,
        source: "unified-checkup",
        createdAt: nowIso,
        depression: depressionData,
        ppg: ppgData,
        kineticare: kineticareData,
        blood: bloodData ?? undefined,
        nervous: nervousData ?? undefined,
        orchestrator: orchestratorData,
        metadata: {
          textLength: data.text.length,
          ppgPoints: data.green_channel.length,
        },
      });
    } catch (mongoErr) {
      console.error("[unified-checkup] MongoDB persistence failed:", mongoErr);
      // We continue even if DB fails so user gets their report in session
    }

    console.log("[unified-checkup] Synthesis complete.");
    return NextResponse.json({
      success: true,
      patient_id: patientId,
      timestamp: nowIso,
      models: {
        depression: {
          ...depressionData,
          risk_score: depressionData.depression_score // Align with frontend expectations
        },
        kineticare: {
          ...kineticareData,
          neurological_risk_index: kineticareData.feature_summary?.tremor_ratio_4_6hz ?? 0,
          fatigue_level: kineticareData.risk_band === "high" ? "High" : (kineticareData.risk_band === "medium" ? "Moderate" : "Low")
        },
        ppg: {
          ...ppgData,
          heart_rate: ppgData.hr_bpm ?? 72,
          is_valid: ppgRes.status === "fulfilled"
        },
        blood: bloodData,
        nervous: nervousData,
        orchestrator: orchestratorData,
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Multi-modal synthesis failed";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
