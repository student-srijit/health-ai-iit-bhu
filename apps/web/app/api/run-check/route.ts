import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";
import { runCheckSchema } from "../../../lib/validation";
import { saveAssessment } from "../../../lib/clinical-store";

type JsonRecord = Record<string, unknown>;

async function postJson(url: string, payload: JsonRecord) {
  return fetchJson<JsonRecord>(url, {
    method: "POST",
    payload,
    timeoutMs: 15000,
    retries: 1,
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = (await req.json()) as unknown;
    const parsed = runCheckSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const useCamera = Boolean(body.useCamera);
    const patientId = body.patientId ?? randomUUID();
    const dwellTimes = body.dwellTimesMs ?? body.dwellTimes;
    const flightTimes = body.flightTimesMs ?? body.flightTimes;
    const hasCameraFeatureVectors = Boolean(body.audioFeatures && body.videoFeatures);
    const hasCameraMetrics = Boolean(body.cameraMetrics);
    const canUseCameraPayload = useCamera && hasCameraFeatureVectors && hasCameraMetrics;
    const hasAnyBloodField = Boolean(body.bloodImageBase64);
    const hasBloodInputs = Boolean(body.bloodImageBase64);

    const hasAnyNervousField = Boolean(
      body.nervousTapIntervalsMs ||
      body.nervousTapDistancesPx ||
      body.nervousTremorSignal ||
      body.nervousSamplingRateHz,
    );
    const hasNervousInputs = Boolean(
      body.nervousTapIntervalsMs &&
      body.nervousTapDistancesPx &&
      body.nervousTremorSignal &&
      body.nervousSamplingRateHz,
    );

    const warnings: string[] = [];
    if (useCamera && !canUseCameraPayload) {
      warnings.push("Camera capture was incomplete, so analysis continued with available modalities.");
    }

    const hasAnyKineticareField = Boolean(dwellTimes || flightTimes || body.imuAccelMagnitude || body.kineticareSamplingRateHz);
    const hasKineticareInputs = Boolean(
      dwellTimes &&
      flightTimes &&
      body.imuAccelMagnitude &&
      body.kineticareSamplingRateHz,
    );

    if (hasAnyKineticareField && !hasKineticareInputs) {
      return NextResponse.json(
        { error: "Incomplete KinetiCare payload. Provide dwellTimes/flightTimes/imuAccelMagnitude/kineticareSamplingRateHz." },
        { status: 400 },
      );
    }

    if (hasAnyNervousField && !hasNervousInputs) {
      return NextResponse.json(
        { error: "Incomplete Nervous payload. Provide nervousTapIntervalsMs/nervousTapDistancesPx/nervousTremorSignal/nervousSamplingRateHz." },
        { status: 400 },
      );
    }

    if (hasAnyBloodField && !hasBloodInputs) {
      return NextResponse.json(
        { error: "Incomplete Blood payload. Provide bloodImageBase64." },
        { status: 400 },
      );
    }

    const hasAnyPpgField = Boolean(body.ppgSignal || body.ppgSamplingRateHz);
    const hasPpgInputs = Boolean(body.ppgSignal && body.ppgSamplingRateHz);

    if (hasAnyPpgField && !hasPpgInputs) {
      return NextResponse.json(
        { error: "Incomplete PPG payload. Provide ppgSignal and ppgSamplingRateHz." },
        { status: 400 },
      );
    }

    const depressionPayload: JsonRecord = {
      patient_id: patientId,
      journal_text: body.journalText,
      audio_features: canUseCameraPayload ? (body.audioFeatures ?? []) : [],
      video_features: canUseCameraPayload ? (body.videoFeatures ?? []) : [],
    };

    if (canUseCameraPayload && body.cameraMetrics) {
      const cameraMetrics: JsonRecord = {
        ...(body.cameraMetrics as JsonRecord),
      };

      if (body.simulateSpoof) {
        cameraMetrics.spoof_probability = 0.95;
        cameraMetrics.frequency_spoof_score = 0.9;
        warnings.push("Anti-spoof simulation is enabled, so camera metrics were intentionally flagged.");
      }

      depressionPayload.camera_metrics = cameraMetrics;
    }

    const depression = await postJson(getServiceUrl("depression", "/predict"), depressionPayload);

    const ppg = hasPpgInputs
      ? await postJson(getServiceUrl("ppg", "/predict"), {
          patient_id: patientId,
          ppg_signal: body.ppgSignal,
          sampling_rate_hz: body.ppgSamplingRateHz,
          baseline_map: body.baselineMap,
        })
      : null;

    const kineticare = hasKineticareInputs
      ? await postJson(getServiceUrl("kineticare", "/predict"), {
          patient_id: patientId,
          dwell_times_ms: dwellTimes,
          flight_times_ms: flightTimes,
          imu_accel_magnitude: body.imuAccelMagnitude,
          sampling_rate_hz: body.kineticareSamplingRateHz,
        })
      : null;

    let nervous: JsonRecord | null = null;
    if (hasNervousInputs) {
      try {
        nervous = await postJson(getServiceUrl("nervous", "/predict"), {
          patient_id: patientId,
          tap_intervals_ms: body.nervousTapIntervalsMs,
          tap_distances_px: body.nervousTapDistancesPx,
          tremor_signal: body.nervousTremorSignal,
          sampling_rate_hz: body.nervousSamplingRateHz,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Nervous predict failed";
        warnings.push(`Nervous service error: ${msg}`);
      }
    }

    let blood: JsonRecord | null = null;
    if (hasBloodInputs) {
      try {
        blood = await postJson(getServiceUrl("blood", "/predict"), {
          patient_id: patientId,
          image_base64: body.bloodImageBase64,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Blood predict failed";
        warnings.push(`Blood service error: ${msg}`);
      }
    }

    const canSummarize = Boolean(ppg && kineticare);

    let orchestrator: JsonRecord | null = null;
    try {
      if (canSummarize) {
        orchestrator = await postJson(getServiceUrl("orchestrator", "/summarize"), {
          patient_id: patientId,
          depression: {
            depression_score: depression.depression_score,
            risk_band: depression.risk_band,
          },
          ppg: {
            map: ppg?.map,
            change_map: ppg?.change_map,
            ratio_map: ppg?.ratio_map,
            risk_band: ppg?.risk_band,
          },
          kineticare: {
            risk_band: kineticare?.risk_band,
            session_quality: kineticare?.session_quality,
            signals_used: kineticare?.signals_used,
          },
          ...(nervous
            ? {
                nervous: {
                  risk_band: nervous.risk_band,
                  tremor_hz: nervous.tremor_hz,
                  tap_rate_hz: nervous.tap_rate_hz,
                  session_quality: nervous.session_quality,
                },
              }
            : {}),
          ...(blood
            ? {
                blood: {
                  hemoglobin_g_dl: blood.hemoglobin_g_dl,
                  risk_band: blood.risk_band,
                  confidence: blood.confidence,
                },
              }
            : {}),
          ...(typeof depression.camera_sqi === "number" && typeof depression.spoof_detected === "boolean"
            ? {
                camera_quality: {
                  status: depression.status,
                  camera_sqi: depression.camera_sqi,
                  spoof_detected: depression.spoof_detected,
                },
              }
            : {}),
        });
      } else {
        orchestrator = await postJson(getServiceUrl("orchestrator", "/huatuo-reason"), {
          prompt: `Patient ${patientId} assessment with partial modalities. Depression risk band: ${String(depression.risk_band)}. Journal summary: ${body.journalText}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown orchestrator error";
      console.error(`[run-check] Orchestrator failed: ${msg}`);
      warnings.push(`Orchestrator service error: ${msg}`);
      orchestrator = {
        overall_risk: "unknown",
        summary: "Orchestrator synthesis unavailable due to service error. Review individual modality results.",
      };
    }

    const nowIso = new Date().toISOString();
    await saveAssessment({
      patientId,
      source: "run-check",
      createdAt: nowIso,
      depression,
      ppg: ppg ?? undefined,
      kineticare: kineticare ?? undefined,
      blood: blood ?? undefined,
      nervous: nervous ?? undefined,
      orchestrator,
      metadata: {
        useCamera,
        simulateSpoof: body.simulateSpoof,
      },
    });

    return NextResponse.json({
      patient_id: patientId,
      depression,
      ppg,
      kineticare,
      blood,
      nervous,
      orchestrator,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow error";
    const stack = error instanceof Error ? error.stack : "";
    console.error(`[run-check] Request failed: ${message}`);
    if (stack) console.error(`[run-check] Stack: ${stack}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
