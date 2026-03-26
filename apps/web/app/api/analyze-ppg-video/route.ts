import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      videoFrames?: string[];
      targetFps?: number;
    };
    const result = await fetchJson<Record<string, unknown>>(
      getServiceUrl("ppg", "/analyze-ppg-video"),
      {
        method: "POST",
        payload: {
          video_frames: body.videoFrames ?? [],
          target_fps: body.targetFps ?? 15,
        },
        timeoutMs: 30000,
        retries: 0,
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PPG video analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
