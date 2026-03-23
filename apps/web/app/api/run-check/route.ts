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

    const canSummarize = Boolean(ppg && kineticare);

    const orchestrator = canSummarize
      ? await postJson(getServiceUrl("orchestrator", "/summarize"), {
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
          ...(typeof depression.camera_sqi === "number" && typeof depression.spoof_detected === "boolean"
            ? {
                camera_quality: {
                  status: depression.status,
                  camera_sqi: depression.camera_sqi,
                  spoof_detected: depression.spoof_detected,
                },
              }
            : {}),
        })
      : await postJson(getServiceUrl("orchestrator", "/huatuo-reason"), {
          prompt: `Patient ${patientId} assessment with partial modalities. Depression risk band: ${String(depression.risk_band)}. Journal summary: ${body.journalText}`,
        });

    const nowIso = new Date().toISOString();
    await saveAssessment({
      patientId,
      source: "run-check",
      createdAt: nowIso,
      depression,
      ppg: ppg ?? undefined,
      kineticare: kineticare ?? undefined,
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
      orchestrator,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
