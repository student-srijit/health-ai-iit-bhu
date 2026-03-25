import { NextRequest, NextResponse } from "next/server";
import {
  getMonitoringSchedule,
  listAssessments,
  listMonitoringCheckins,
  listPrescriptions,
} from "../../../lib/clinical-store";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "patientId query param is required" }, { status: 400 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit") ?? "50";
  const limit = Number(limitRaw);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
    return NextResponse.json({ error: "limit must be between 1 and 500" }, { status: 400 });
  }

  const daysRaw = req.nextUrl.searchParams.get("days") ?? "30";
  const days = Number(daysRaw);
  if (!Number.isFinite(days) || days <= 0 || days > 3650) {
    return NextResponse.json({ error: "days must be between 1 and 3650" }, { status: 400 });
  }

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const [assessments, prescriptions, schedule, checkins] = await Promise.all([
      listAssessments(patientId, limit),
      listPrescriptions(patientId),
      getMonitoringSchedule(patientId),
      listMonitoringCheckins(patientId, since),
    ]);

    return NextResponse.json({
      patientId,
      since,
      assessments,
      prescriptions,
      monitoring: {
        schedule,
        checkins,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load patient history";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
