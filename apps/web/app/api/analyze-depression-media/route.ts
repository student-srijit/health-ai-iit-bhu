import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      audioBase64?: string;
      videoFrames?: string[];
      sampleRate?: number;
    };
    const result = await fetchJson<Record<string, unknown>>(
      getServiceUrl("depression", "/analyze-media"),
      {
        method: "POST",
        payload: {
          audio_base64: body.audioBase64 ?? "",
          video_frames: body.videoFrames ?? [],
          sample_rate: body.sampleRate ?? 16000,
        },
        timeoutMs: 30000,
        retries: 0,
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
