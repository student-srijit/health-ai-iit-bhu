import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { prompt?: string };
    if (!body.prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    const result = await fetchJson<Record<string, unknown>>(
      getServiceUrl("orchestrator", "/huatuo-reason"),
      {
        method: "POST",
        payload: { prompt: body.prompt },
        timeoutMs: 60000,
        retries: 0,
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "HuatuoGPT call failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
