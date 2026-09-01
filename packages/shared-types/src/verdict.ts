import { z } from "zod";

export const ArbiterVerdictSchema = z.object({
  round: z.number().int().positive(),
  converging: z.boolean(),
  gap: z.number().min(0).max(100),
  settled: z.boolean(),
  deadlock: z.boolean(),
  reason: z.string().optional(),
});

export type ArbiterVerdict = z.infer<typeof ArbiterVerdictSchema>;
