import { NextRequest, NextResponse } from "next/server";
import { getMonitoringSchedule, upsertMonitoringSchedule } from "../../../lib/clinical-store";
import { monitoringScheduleSchema } from "../../../lib/validation";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "patientId query param is required" }, { status: 400 });
  }

  try {
    const schedule = await getMonitoringSchedule(patientId);
    return NextResponse.json({ patientId, schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get monitoring schedule";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as unknown;
    const parsed = monitoringScheduleSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid monitoring schedule payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    await upsertMonitoringSchedule({
      ...parsed.data,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return NextResponse.json({ ok: true, updatedAt: nowIso });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upsert monitoring schedule";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
