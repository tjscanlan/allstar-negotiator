import { describe, expect, test } from "bun:test";
import { ArbiterVerdictSchema, NegotiationEventSchema, ProposalSchema, ProposalTermsSchema } from "./index";

const validProposal = {
  agentId: "agent-a",
  round: 1,
  terms: { agentShare: 60, counterpartyShare: 40 },
  rationale: "opening ask",
  action: "propose",
};

describe("ProposalTermsSchema", () => {
  test("accepts shares at the 0 and 100 bounds", () => {
    expect(ProposalTermsSchema.safeParse({ agentShare: 0, counterpartyShare: 100 }).success).toBe(true);
  });

  test("rejects shares outside 0-100", () => {
    expect(ProposalTermsSchema.safeParse({ agentShare: -1, counterpartyShare: 50 }).success).toBe(false);
    expect(ProposalTermsSchema.safeParse({ agentShare: 50, counterpartyShare: 101 }).success).toBe(false);
  });

  test("notes is optional but must be a string when present", () => {
    expect(ProposalTermsSchema.safeParse({ agentShare: 50, counterpartyShare: 50, notes: "x" }).success).toBe(true);
    expect(ProposalTermsSchema.safeParse({ agentShare: 50, counterpartyShare: 50, notes: 1 }).success).toBe(false);
  });
});

describe("ProposalSchema", () => {
  test("accepts a well-formed proposal", () => {
    expect(ProposalSchema.parse(validProposal)).toEqual(validProposal as never);
  });

  test("rejects an unknown agentId", () => {
    expect(ProposalSchema.safeParse({ ...validProposal, agentId: "agent-c" }).success).toBe(false);
  });

  test("rejects an unknown action", () => {
    expect(ProposalSchema.safeParse({ ...validProposal, action: "walk-away" }).success).toBe(false);
  });

  test("requires a positive integer round", () => {
    expect(ProposalSchema.safeParse({ ...validProposal, round: 0 }).success).toBe(false);
    expect(ProposalSchema.safeParse({ ...validProposal, round: 1.5 }).success).toBe(false);
  });
});

describe("ArbiterVerdictSchema", () => {
  const verdict = { round: 2, converging: true, gap: 3, settled: true, deadlock: false };

  test("accepts a verdict with or without a reason", () => {
    expect(ArbiterVerdictSchema.safeParse(verdict).success).toBe(true);
    expect(ArbiterVerdictSchema.safeParse({ ...verdict, reason: "closed" }).success).toBe(true);
  });

  test("rejects a gap above 100", () => {
    expect(ArbiterVerdictSchema.safeParse({ ...verdict, gap: 101 }).success).toBe(false);
  });
});

describe("NegotiationEventSchema", () => {
  test("parses every event variant", () => {
    const events = [
      { type: "round_started", round: 1 },
      { type: "proposal", proposal: validProposal },
      { type: "verdict", verdict: { round: 1, converging: false, gap: 10, settled: false, deadlock: false } },
      { type: "settled", round: 3, finalTerms: { agentShare: 57, counterpartyShare: 43 } },
      { type: "deadlock", round: 8, reason: "max rounds" },
    ];
    for (const event of events) {
      expect(NegotiationEventSchema.safeParse(event).success).toBe(true);
    }
  });

  test("allows deadlock at round 0 (synthetic orchestrator-error event) but not round_started", () => {
    expect(NegotiationEventSchema.safeParse({ type: "deadlock", round: 0, reason: "boom" }).success).toBe(true);
    expect(NegotiationEventSchema.safeParse({ type: "round_started", round: 0 }).success).toBe(false);
  });

  test("rejects an unknown event type", () => {
    expect(NegotiationEventSchema.safeParse({ type: "paused", round: 1 }).success).toBe(false);
  });

  test("rejects a deadlock without a reason", () => {
    expect(NegotiationEventSchema.safeParse({ type: "deadlock", round: 2 }).success).toBe(false);
  });
});
