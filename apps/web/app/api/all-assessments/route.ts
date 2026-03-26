import { NextRequest, NextResponse } from "next/server";
import { listAllAssessments } from "../../../lib/clinical-store";

export async function GET(req: NextRequest) {
  const limitRaw = req.nextUrl.searchParams.get("limit") ?? "100";
  const limit = Number(limitRaw);
  
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
    return NextResponse.json({ error: "limit must be between 1 and 500" }, { status: 400 });
  }

  try {
    const assessments = await listAllAssessments(limit);
    return NextResponse.json({ assessments });
  } catch (error) {
    console.error("[all-assessments] Database error:", error);
    // Return empty list instead of 502 for better UI resilience
    return NextResponse.json({ 
      assessments: [],
      warning: "Database unreachable, showing empty cohort."
    });
  }
}
