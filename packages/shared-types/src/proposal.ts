import { z } from "zod";

export const ProposalActionSchema = z.enum(["propose", "accept", "reject"]);

export const ProposalTermsSchema = z.object({
  agentShare: z.number().min(0).max(100),
  counterpartyShare: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export const ProposalSchema = z.object({
  agentId: z.enum(["agent-a", "agent-b"]),
  round: z.number().int().positive(),
  terms: ProposalTermsSchema,
  rationale: z.string(),
  action: ProposalActionSchema,
});

export type ProposalAction = z.infer<typeof ProposalActionSchema>;
export type ProposalTerms = z.infer<typeof ProposalTermsSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
