import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";
import { runCheckSchema } from "../../../lib/validation";

type JsonRecord = Record<string, unknown>;

async function postJson(url: string, payload: JsonRecord) {
  return fetchJson<JsonRecord>(url, {
    method: "POST",
    payload,
    timeoutMs: 15000,
    retries: 0,
  });
}

const max = (a: number, b: number) => a > b ? a : b;

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
    const simulateSpoof = Boolean(body.simulateSpoof);
    const patientId = body.patientId ?? randomUUID();

    // Use real features from VideoCapture if provided, otherwise fall back to simulated
    const audioFeatures =
      body.audioFeatures && body.audioFeatures.length >= 32
        ? body.audioFeatures
        : new Array(128).fill(0.2);
    const videoFeatures =
      body.videoFeatures && body.videoFeatures.length >= 32
        ? body.videoFeatures
        : new Array(128).fill(0.15);

    const depressionPayload: JsonRecord = {
      patient_id: patientId,
      journal_text: body.journalText,
      audio_features: audioFeatures,
      video_features: videoFeatures,
    };

    if (useCamera) {
      depressionPayload.camera_metrics = {
        frame_quality_score: simulateSpoof ? 0.4 : 0.95,
        blur_score: simulateSpoof ? 0.75 : 0.1,
        face_tracking_confidence: simulateSpoof ? 0.4 : 0.93,
        spoof_probability: simulateSpoof ? 0.92 : 0.05,
        accepted_window_ratio: simulateSpoof ? 0.38 : 0.94,
        laplacian_variance: simulateSpoof ? 5.0 : 45.0,
        frequency_spoof_score: simulateSpoof ? 0.92 : 0.1,
      };
    }

    const ppgPayload: JsonRecord = {
      patient_id: patientId,
      ppg_signal: [0.1, 0.12, 0.08, 0.11, 0.15, 0.09, 0.13, 0.1].flatMap((x) =>
        new Array(70).fill(x),
      ),
      sampling_rate_hz: 100,
      baseline_map: body.baselineMap,
    };

    const clientDwell = Array.isArray(body.dwellTimes) && body.dwellTimes.length > 0 ? body.dwellTimes : [110, 115, 120, 95, 140, 130];
    const clientFlight = Array.isArray(body.flightTimes) && body.flightTimes.length > 0 ? body.flightTimes : [90, 85, 95, 88, 100, 92];
    const clientImu = Array.isArray(body.imuAccelMagnitude) && body.imuAccelMagnitude.length > 0 ? body.imuAccelMagnitude : [0.02, 0.01, 0.03, 0.02];

    const kineticarePayload: JsonRecord = {
      patient_id: patientId,
      dwell_times_ms: [...clientDwell, ...new Array(max(0, 16 - clientDwell.length)).fill(115)],
      flight_times_ms: [...clientFlight, ...new Array(max(0, 16 - clientFlight.length)).fill(90)],
      imu_accel_magnitude: [...clientImu, ...new Array(max(0, 128 - clientImu.length)).fill(0.02)],
      sampling_rate_hz: 50,
    };

    const [depression, ppg, kineticare] = await Promise.all([
      postJson(getServiceUrl("depression", "/predict"), depressionPayload),
      postJson(getServiceUrl("ppg", "/predict"), ppgPayload),
      postJson(getServiceUrl("kineticare", "/predict"), kineticarePayload),
    ]);

    const orchestratorPayload: JsonRecord = {
      patient_id: patientId,
      depression: {
        depression_score: depression.depression_score,
        risk_band: depression.risk_band,
      },
      ppg: {
        map: ppg.map,
        change_map: ppg.change_map,
        ratio_map: ppg.ratio_map,
        sbp: (ppg.sbp ?? 120) as number,
        dbp: (ppg.dbp ?? 80) as number,
        hr_bpm: (ppg.hr_bpm ?? 72) as number,
        risk_band: ppg.risk_band,
      },
      kineticare: {
        risk_band: kineticare.risk_band,
        session_quality: kineticare.session_quality,
        signals_used: kineticare.signals_used,
      },
      camera_quality: {
        status: depression.status,
        camera_sqi: (depression.camera_sqi ?? 1.0) as number,
        spoof_detected: (depression.spoof_detected ?? false) as boolean,
      },
    };

    const orchestrator = await postJson(
      getServiceUrl("orchestrator", "/summarize"),
      orchestratorPayload,
    );

    return NextResponse.json({
      patient_id: patientId,
      depression,
      ppg,
      kineticare,
      orchestrator,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
