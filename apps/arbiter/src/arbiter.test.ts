import { describe, expect, test } from "bun:test";
import type { Proposal } from "@negotiator/shared-types";
import { evaluateRound, INITIAL_ARBITER_STATE, MAX_ROUNDS, STALL_ROUNDS } from "./arbiter";

function proposal(overrides: Partial<Proposal> & { agentId: "agent-a" | "agent-b"; round: number }): Proposal {
  return {
    terms: { agentShare: 50, counterpartyShare: 50 },
    rationale: "test",
    action: "propose",
    ...overrides,
  };
}

describe("evaluateRound", () => {
  test("converges to settlement as proposals align", () => {
    let state = INITIAL_ARBITER_STATE;

    const round1 = evaluateRound(
      1,
      proposal({ agentId: "agent-a", round: 1, terms: { agentShare: 70, counterpartyShare: 30 } }),
      proposal({ agentId: "agent-b", round: 1, terms: { agentShare: 60, counterpartyShare: 40 } }),
      state,
    );
    expect(round1.verdict.converging).toBe(false); // no prior gap to compare on round 1
    expect(round1.verdict.settled).toBe(false);
    expect(round1.verdict.deadlock).toBe(false);
    state = round1.nextState;

    const round2 = evaluateRound(
      2,
      proposal({ agentId: "agent-a", round: 2, terms: { agentShare: 58, counterpartyShare: 42 } }),
      proposal({ agentId: "agent-b", round: 2, terms: { agentShare: 43, counterpartyShare: 57 } }),
      state,
    );
    expect(round2.verdict.converging).toBe(true);
    expect(round2.verdict.settled).toBe(true);
    expect(round2.verdict.deadlock).toBe(false);
  });

  test("declares deadlock after gap fails to shrink for STALL_ROUNDS consecutive rounds", () => {
    let state = INITIAL_ARBITER_STATE;
    let lastResult;

    for (let round = 1; round <= STALL_ROUNDS + 1; round++) {
      lastResult = evaluateRound(
        round,
        proposal({ agentId: "agent-a", round, terms: { agentShare: 80, counterpartyShare: 20 } }),
        proposal({ agentId: "agent-b", round, terms: { agentShare: 80, counterpartyShare: 20 } }),
        state,
      );
      state = lastResult.nextState;
    }

    expect(lastResult!.verdict.settled).toBe(false);
    expect(lastResult!.verdict.deadlock).toBe(true);
    expect(lastResult!.verdict.reason).toContain("consecutive rounds");
  });

  test("declares deadlock at the MAX_ROUNDS boundary without settling", () => {
    let state = INITIAL_ARBITER_STATE;
    let lastResult;

    // Alternate the gap up and down each round so it never "stalls" via
    // STALL_ROUNDS, but also never closes — isolates the MAX_ROUNDS path.
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const wide = round % 2 === 1;
      lastResult = evaluateRound(
        round,
        proposal({
          agentId: "agent-a",
          round,
          terms: { agentShare: wide ? 90 : 85, counterpartyShare: 10 },
        }),
        proposal({
          agentId: "agent-b",
          round,
          terms: { agentShare: wide ? 90 : 85, counterpartyShare: 10 },
        }),
        state,
      );
      state = lastResult.nextState;
    }

    expect(lastResult!.verdict.round).toBe(MAX_ROUNDS);
    expect(lastResult!.verdict.settled).toBe(false);
    expect(lastResult!.verdict.deadlock).toBe(true);
    expect(lastResult!.verdict.reason).toContain("max rounds");
  });

  test("settles immediately when both agents explicitly accept, regardless of gap", () => {
    const result = evaluateRound(
      3,
      proposal({
        agentId: "agent-a",
        round: 3,
        terms: { agentShare: 90, counterpartyShare: 10 },
        action: "accept",
      }),
      proposal({
        agentId: "agent-b",
        round: 3,
        terms: { agentShare: 90, counterpartyShare: 10 },
        action: "accept",
      }),
      INITIAL_ARBITER_STATE,
    );

    expect(result.verdict.gap).toBeGreaterThan(5);
    expect(result.verdict.settled).toBe(true);
    expect(result.verdict.reason).toBe("both agents accepted");
  });

  test("does not settle on a one-sided accept", () => {
    const result = evaluateRound(
      3,
      proposal({
        agentId: "agent-a",
        round: 3,
        terms: { agentShare: 90, counterpartyShare: 10 },
        action: "accept",
      }),
      proposal({
        agentId: "agent-b",
        round: 3,
        terms: { agentShare: 90, counterpartyShare: 10 },
        action: "propose",
      }),
      INITIAL_ARBITER_STATE,
    );

    expect(result.verdict.settled).toBe(false);
  });
});
