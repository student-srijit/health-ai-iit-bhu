import { z } from "zod";

export const runCheckSchema = z.object({
  journalText: z.string().min(1).max(10000),
  baselineMap: z.number().min(1).max(250),
  useCamera: z.boolean(),
  simulateSpoof: z.boolean(),
  audioFeatures: z.array(z.number()).optional(),
  videoFeatures: z.array(z.number()).optional(),
  patientId: z.string().optional(),
  dwellTimes: z.array(z.number()).optional(),
  flightTimes: z.array(z.number()).optional(),
  imuAccelMagnitude: z.array(z.number()).optional(),
});

export type RunCheckInput = z.infer<typeof runCheckSchema>;
