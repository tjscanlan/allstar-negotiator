import { beforeEach, describe, expect, mock, test } from "bun:test";
import { MAX_ROUNDS, STALL_ROUNDS } from "@negotiator/arbiter";
import type { NegotiationEvent, Proposal } from "@negotiator/shared-types";

// Agents are stubbed (no LLM); the arbiter stays real since it's pure.
const agentA = { proposeOpeningTerms: mock(), reactToProposal: mock() };
const agentB = { proposeOpeningTerms: mock(), reactToProposal: mock() };
mock.module("@negotiator/agent-a", () => agentA);
mock.module("@negotiator/agent-b", () => agentB);

const { runNegotiation } = await import("./runNegotiation");

function proposal(
  agentId: Proposal["agentId"],
  round: number,
  agentShare: number,
  counterpartyShare: number,
  action: Proposal["action"] = "propose",
): Proposal {
  return { agentId, round, terms: { agentShare, counterpartyShare }, rationale: `${agentId} r${round}`, action };
}

async function collectEvents(): Promise<NegotiationEvent[]> {
  const events: NegotiationEvent[] = [];
  await runNegotiation((event) => events.push(event));
  return events;
}

describe("runNegotiation", () => {
  beforeEach(() => {
    for (const fn of [...Object.values(agentA), ...Object.values(agentB)]) fn.mockReset();
  });

  test("settles in round 1 when opening proposals already mirror each other", async () => {
    agentA.proposeOpeningTerms.mockResolvedValue(proposal("agent-a", 1, 58, 42));
    agentB.proposeOpeningTerms.mockResolvedValue(proposal("agent-b", 1, 42, 58));

    const events = await collectEvents();

    expect(events.map((e) => e.type)).toEqual(["round_started", "proposal", "proposal", "verdict", "settled"]);
    expect(events.at(-1)).toEqual({
      type: "settled",
      round: 1,
      finalTerms: { agentShare: 58, counterpartyShare: 42, notes: "reconciled from both agents' final proposals" },
      reason: "gap closed within settlement threshold",
    });
    expect(agentA.reactToProposal).not.toHaveBeenCalled();
    expect(agentB.reactToProposal).not.toHaveBeenCalled();
  });

  test("reconciles final terms by averaging each side's ask with the other's offer", async () => {
    agentA.proposeOpeningTerms.mockResolvedValue(proposal("agent-a", 1, 60, 40));
    agentB.proposeOpeningTerms.mockResolvedValue(proposal("agent-b", 1, 44, 56));

    const events = await collectEvents();
    const settled = events.at(-1);

    expect(settled?.type).toBe("settled");
    if (settled?.type !== "settled") return;
    expect(settled.finalTerms.agentShare).toBe(58); // (60 + 56) / 2
    expect(settled.finalTerms.counterpartyShare).toBe(42); // (44 + 40) / 2
  });

  test("feeds each agent the counterparty's previous proposal and its own history", async () => {
    const a1 = proposal("agent-a", 1, 80, 20);
    const b1 = proposal("agent-b", 1, 70, 30);
    const a2 = proposal("agent-a", 2, 57, 43);
    const b2 = proposal("agent-b", 2, 43, 57);
    agentA.proposeOpeningTerms.mockResolvedValue(a1);
    agentB.proposeOpeningTerms.mockResolvedValue(b1);
    agentA.reactToProposal.mockResolvedValue(a2);
    agentB.reactToProposal.mockResolvedValue(b2);

    const events = await collectEvents();

    expect(agentA.reactToProposal).toHaveBeenCalledWith(2, b1, [a1]);
    expect(agentB.reactToProposal).toHaveBeenCalledWith(2, a1, [b1]);
    expect(events.filter((e) => e.type === "round_started")).toEqual([
      { type: "round_started", round: 1 },
      { type: "round_started", round: 2 },
    ]);
    expect(events.at(-1)?.type).toBe("settled");
  });

  test("emits proposals in A-then-B order followed by the round's verdict", async () => {
    agentA.proposeOpeningTerms.mockResolvedValue(proposal("agent-a", 1, 55, 45));
    agentB.proposeOpeningTerms.mockResolvedValue(proposal("agent-b", 1, 45, 55));

    const events = await collectEvents();

    expect(events[1]).toEqual({ type: "proposal", proposal: proposal("agent-a", 1, 55, 45) });
    expect(events[2]).toEqual({ type: "proposal", proposal: proposal("agent-b", 1, 45, 55) });
    expect(events[3]).toMatchObject({ type: "verdict", verdict: { round: 1, gap: 0, settled: true } });
  });

  test("ends with a deadlock event when the gap stalls", async () => {
    const stuckA = (round: number) => proposal("agent-a", round, 90, 10);
    const stuckB = (round: number) => proposal("agent-b", round, 90, 10);
    agentA.proposeOpeningTerms.mockImplementation(async (round: number) => stuckA(round));
    agentB.proposeOpeningTerms.mockImplementation(async (round: number) => stuckB(round));
    agentA.reactToProposal.mockImplementation(async (round: number) => stuckA(round));
    agentB.reactToProposal.mockImplementation(async (round: number) => stuckB(round));

    const events = await collectEvents();

    const last = events.at(-1);
    expect(last).toEqual({
      type: "deadlock",
      round: STALL_ROUNDS + 1,
      reason: `gap has not shrunk for ${STALL_ROUNDS} consecutive rounds`,
    });
    expect(events.some((e) => e.type === "settled")).toBe(false);
    expect(STALL_ROUNDS + 1).toBeLessThanOrEqual(MAX_ROUNDS);
  });

  test("rejects (without a terminal event) when an agent call fails", async () => {
    agentA.proposeOpeningTerms.mockRejectedValue(new Error("no api key"));
    agentB.proposeOpeningTerms.mockResolvedValue(proposal("agent-b", 1, 45, 55));

    const events: NegotiationEvent[] = [];
    await expect(runNegotiation((e) => events.push(e))).rejects.toThrow("no api key");
    expect(events).toEqual([{ type: "round_started", round: 1 }]);
  });
});
