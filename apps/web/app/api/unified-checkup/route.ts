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

    const [depressionData, ppgData, kineticareData] = await Promise.all([
      fetchJson<Record<string, unknown>>(getServiceUrl("depression", "/predict"), {
        method: "POST",
        payload: depressionPayload,
        timeoutMs: 20000,
        retries: 1,
      }),
      fetchJson<Record<string, unknown>>(getServiceUrl("ppg", "/predict"), {
        method: "POST",
        payload: ppgPayload,
        timeoutMs: 20000,
        retries: 1,
      }),
      fetchJson<Record<string, unknown>>(getServiceUrl("kineticare", "/predict"), {
        method: "POST",
        payload: kineticarePayload,
        timeoutMs: 20000,
        retries: 1,
      }),
    ]);

    let bloodData: Record<string, unknown> | null = null;
    if (data.bloodImageBase64) {
      try {
        bloodData = await fetchJson<Record<string, unknown>>(getServiceUrl("blood", "/predict"), {
          method: "POST",
          payload: {
            patient_id: patientId,
            image_base64: data.bloodImageBase64,
          },
          timeoutMs: 20000,
          retries: 1,
        });
      } catch (err) {
        console.warn("Blood service failed:", err instanceof Error ? err.message : "Unknown error");
      }
    }

    let nervousData: Record<string, unknown> | null = null;
    if (hasNervousInputs) {
      try {
        nervousData = await fetchJson<Record<string, unknown>>(getServiceUrl("nervous", "/predict"), {
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
        console.warn("Nervous service failed:", err instanceof Error ? err.message : "Unknown error");
      }
    }

    const orchestratorData = await fetchJson<Record<string, unknown>>(
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
        timeoutMs: 20000,
        retries: 1,
      },
    );

    const nowIso = new Date().toISOString();
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

    return NextResponse.json({
      success: true,
      patient_id: patientId,
      timestamp: nowIso,
      models: {
        depression: depressionData,
        kineticare: kineticareData,
        ppg: ppgData,
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
