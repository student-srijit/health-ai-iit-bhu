import { type Document } from "mongodb";
import { getMongoDb } from "./mongodb";

export type RiskBand = "low" | "medium" | "high";

export type StoredAssessment = {
  patientId: string;
  source: "run-check" | "unified-checkup";
  createdAt: string;
  depression?: Record<string, unknown>;
  ppg?: Record<string, unknown>;
  kineticare?: Record<string, unknown>;
  blood?: Record<string, unknown>;
  nervous?: Record<string, unknown>;
  orchestrator?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type StoredPrescription = {
  patientId: string;
  clinicianId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  interactionWarnings: string[];
  status: "active" | "paused" | "discontinued";
  createdAt: string;
  updatedAt: string;
};

export type StoredMonitoringSchedule = {
  patientId: string;
  timezone: string;
  checkTimes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoredMonitoringCheckin = {
  patientId: string;
  scheduledAt: string;
  completedAt?: string;
  status: "scheduled" | "completed" | "missed" | "escalated";
  source: "daily-checkup" | "manual";
  assessmentId?: string;
  notes?: string;
  createdAt: string;
};

let indexesInitialized = false;

async function ensureIndexes(): Promise<void> {
  if (indexesInitialized) {
    return;
  }

  const db = await getMongoDb();
  await Promise.all([
    db.collection("assessments").createIndexes([
      { key: { patientId: 1, createdAt: -1 }, name: "assessments_patient_createdAt" },
      { key: { source: 1 }, name: "assessments_source" },
    ]),
    db.collection("prescriptions").createIndexes([
      { key: { patientId: 1, status: 1, updatedAt: -1 }, name: "prescriptions_patient_status_updatedAt" },
      { key: { clinicianId: 1, updatedAt: -1 }, name: "prescriptions_clinician_updatedAt" },
    ]),
    db.collection("monitoring_schedules").createIndexes([
      { key: { patientId: 1 }, unique: true, name: "monitoring_schedules_patient_unique" },
    ]),
    db.collection("monitoring_checkins").createIndexes([
      { key: { patientId: 1, scheduledAt: -1 }, name: "monitoring_checkins_patient_scheduledAt" },
      { key: { status: 1, scheduledAt: -1 }, name: "monitoring_checkins_status_scheduledAt" },
    ]),
  ]);

  indexesInitialized = true;
}

function stripMongoId<T extends Document>(doc: T): Omit<T, "_id"> {
  const { _id: _, ...rest } = doc;
  return rest;
}

export async function saveAssessment(doc: StoredAssessment): Promise<void> {
  await ensureIndexes();
  const db = await getMongoDb();
  await db.collection<StoredAssessment>("assessments").insertOne(doc);
}

export async function listAssessments(patientId: string, limit: number): Promise<StoredAssessment[]> {
  await ensureIndexes();
  const db = await getMongoDb();
  const rows = await db
    .collection<StoredAssessment>("assessments")
    .find({ patientId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => stripMongoId(r as StoredAssessment & Document));
}

export async function createPrescription(doc: StoredPrescription): Promise<void> {
  await ensureIndexes();
  const db = await getMongoDb();
  await db.collection<StoredPrescription>("prescriptions").insertOne(doc);
}

export async function listPrescriptions(patientId: string): Promise<StoredPrescription[]> {
  await ensureIndexes();
  const db = await getMongoDb();
  const rows = await db
    .collection<StoredPrescription>("prescriptions")
    .find({ patientId })
    .sort({ updatedAt: -1 })
    .toArray();
  return rows.map((r) => stripMongoId(r as StoredPrescription & Document));
}

export async function upsertMonitoringSchedule(doc: StoredMonitoringSchedule): Promise<void> {
  await ensureIndexes();
  const db = await getMongoDb();
  await db.collection<StoredMonitoringSchedule>("monitoring_schedules").updateOne(
    { patientId: doc.patientId },
    { $set: doc },
    { upsert: true },
  );
}

export async function getMonitoringSchedule(patientId: string): Promise<StoredMonitoringSchedule | null> {
  await ensureIndexes();
  const db = await getMongoDb();
  const row = await db.collection<StoredMonitoringSchedule>("monitoring_schedules").findOne({ patientId });
  return row ? stripMongoId(row as StoredMonitoringSchedule & Document) : null;
}

export async function createMonitoringCheckin(doc: StoredMonitoringCheckin): Promise<void> {
  await ensureIndexes();
  const db = await getMongoDb();
  await db.collection<StoredMonitoringCheckin>("monitoring_checkins").insertOne(doc);
}

export async function listMonitoringCheckins(patientId: string, sinceIso: string): Promise<StoredMonitoringCheckin[]> {
  await ensureIndexes();
  const db = await getMongoDb();
  const rows = await db
    .collection<StoredMonitoringCheckin>("monitoring_checkins")
    .find({ patientId, scheduledAt: { $gte: sinceIso } })
    .sort({ scheduledAt: -1 })
    .toArray();
  return rows.map((r) => stripMongoId(r as StoredMonitoringCheckin & Document));
}