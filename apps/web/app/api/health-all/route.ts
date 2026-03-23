import { NextResponse } from "next/server";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";

const SERVICES: Record<string, string> = {
  web: getServiceUrl("web", "/api/health"),
  depression: getServiceUrl("depression", "/health"),
  ppg: getServiceUrl("ppg", "/health"),
  orchestrator: getServiceUrl("orchestrator", "/health"),
  kineticare: getServiceUrl("kineticare", "/health"),
};

async function check(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await fetchJson<{ status?: string; service?: string }>(url, {
      method: "GET",
      timeoutMs: 5000,
      retries: 1,
    });
    return { ok: true, message: `${data.service ?? "service"}:${data.status ?? "ok"}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unreachable";
    return { ok: false, message: msg };
  }
}

export async function GET() {
  const entries = await Promise.all(
    Object.entries(SERVICES).map(async ([name, url]) => [name, await check(url)] as const),
  );
  return NextResponse.json(Object.fromEntries(entries));
}
