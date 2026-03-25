import { NextRequest, NextResponse } from "next/server";
import { createPrescription, listPrescriptions } from "../../../lib/clinical-store";
import { prescriptionCreateSchema } from "../../../lib/validation";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "patientId query param is required" }, { status: 400 });
  }

  try {
    const data = await listPrescriptions(patientId);
    return NextResponse.json({ patientId, prescriptions: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list prescriptions";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as unknown;
    const parsed = prescriptionCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid prescription payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    await createPrescription({
      ...parsed.data,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return NextResponse.json({ ok: true, createdAt: nowIso });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create prescription";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
