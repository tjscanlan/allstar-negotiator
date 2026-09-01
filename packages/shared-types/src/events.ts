import { z } from "zod";
import { ProposalSchema, ProposalTermsSchema } from "./proposal";
import { ArbiterVerdictSchema } from "./verdict";

export const RoundStartedEventSchema = z.object({
  type: z.literal("round_started"),
  round: z.number().int().positive(),
});

export const ProposalEventSchema = z.object({
  type: z.literal("proposal"),
  proposal: ProposalSchema,
});

export const VerdictEventSchema = z.object({
  type: z.literal("verdict"),
  verdict: ArbiterVerdictSchema,
});

export const SettledEventSchema = z.object({
  type: z.literal("settled"),
  round: z.number().int().positive(),
  finalTerms: ProposalTermsSchema,
  reason: z.string().optional(),
});

export const DeadlockEventSchema = z.object({
  type: z.literal("deadlock"),
  round: z.number().int().nonnegative(),
  reason: z.string(),
});

export const NegotiationEventSchema = z.discriminatedUnion("type", [
  RoundStartedEventSchema,
  ProposalEventSchema,
  VerdictEventSchema,
  SettledEventSchema,
  DeadlockEventSchema,
]);

export type RoundStartedEvent = z.infer<typeof RoundStartedEventSchema>;
export type ProposalEvent = z.infer<typeof ProposalEventSchema>;
export type VerdictEvent = z.infer<typeof VerdictEventSchema>;
export type SettledEvent = z.infer<typeof SettledEventSchema>;
export type DeadlockEvent = z.infer<typeof DeadlockEventSchema>;
export type NegotiationEvent = z.infer<typeof NegotiationEventSchema>;
