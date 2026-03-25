import { NextRequest, NextResponse } from "next/server";
import { createMonitoringCheckin, listMonitoringCheckins } from "../../../lib/clinical-store";
import { monitoringCheckinSchema } from "../../../lib/validation";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "patientId query param is required" }, { status: 400 });
  }

  const daysRaw = req.nextUrl.searchParams.get("days") ?? "30";
  const days = Number(daysRaw);
  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ error: "days must be a positive number" }, { status: 400 });
  }

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const checkins = await listMonitoringCheckins(patientId, since);
    return NextResponse.json({ patientId, since, checkins });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list monitoring checkins";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as unknown;
    const parsed = monitoringCheckinSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid monitoring checkin payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    await createMonitoringCheckin({
      ...parsed.data,
      createdAt: nowIso,
    });

    return NextResponse.json({ ok: true, createdAt: nowIso });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create monitoring checkin";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
