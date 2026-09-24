/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import type { NegotiationEvent, Proposal } from "@negotiator/shared-types";
import { INITIAL_STATE, reducer, type LedgerState } from "./App";

function proposal(agentId: Proposal["agentId"], round: number): Proposal {
  return { agentId, round, terms: { agentShare: 60, counterpartyShare: 40 }, rationale: "r", action: "propose" };
}

function applyEvents(state: LedgerState, events: NegotiationEvent[]): LedgerState {
  return events.reduce((s, event) => reducer(s, { type: "negotiationEvent", event }), state);
}

describe("ledger reducer: connection lifecycle", () => {
  test("start resets to a busy, empty ledger", () => {
    const dirty: LedgerState = { ...INITIAL_STATE, round: 4, proposalsA: [proposal("agent-a", 1)] };
    expect(reducer(dirty, { type: "start" })).toEqual({ ...INITIAL_STATE, busy: true, statusText: "starting…" });
  });

  test("connected, connectionError and startFailed update the status", () => {
    const busy = reducer(INITIAL_STATE, { type: "start" });
    expect(reducer(busy, { type: "connected" })).toMatchObject({ statusText: "connected", statusKind: "connected" });
    expect(reducer(busy, { type: "connectionError" })).toMatchObject({
      statusText: "connection error",
      statusKind: "error",
      busy: true,
    });
    expect(reducer(busy, { type: "startFailed" })).toMatchObject({
      statusText: "failed to start",
      statusKind: "error",
      busy: false,
    });
  });

  test("closed clears busy but keeps the ledger contents", () => {
    const state = { ...INITIAL_STATE, busy: true, round: 3, statusText: "settled" };
    expect(reducer(state, { type: "closed" })).toEqual({ ...state, busy: false });
  });
});

describe("ledger reducer: negotiation events", () => {
  test("round_started sets the current round", () => {
    expect(applyEvents(INITIAL_STATE, [{ type: "round_started", round: 3 }]).round).toBe(3);
  });

  test("proposals are routed to their agent's column, newest first", () => {
    const state = applyEvents(INITIAL_STATE, [
      { type: "proposal", proposal: proposal("agent-a", 1) },
      { type: "proposal", proposal: proposal("agent-b", 1) },
      { type: "proposal", proposal: proposal("agent-a", 2) },
    ]);
    expect(state.proposalsA.map((p) => p.round)).toEqual([2, 1]);
    expect(state.proposalsB.map((p) => p.round)).toEqual([1]);
  });

  test("verdict updates round, gap and converging", () => {
    const state = applyEvents(INITIAL_STATE, [
      { type: "verdict", verdict: { round: 2, gap: 7.5, converging: true, settled: false, deadlock: false } },
    ]);
    expect(state).toMatchObject({ round: 2, gap: 7.5, converging: true });
  });

  test("settled produces a formatted settled terminal", () => {
    const state = applyEvents(INITIAL_STATE, [
      { type: "settled", round: 4, finalTerms: { agentShare: 57.25, counterpartyShare: 42.75 }, reason: "both agents accepted" },
    ]);
    expect(state.statusText).toBe("settled");
    expect(state.statusKind).toBe("connected");
    expect(state.terminal).toEqual({
      kind: "settled",
      text: "Settled in round 4: 57.3% / 42.8% — both agents accepted",
    });
  });

  test("settled without a reason omits the trailing dash", () => {
    const state = applyEvents(INITIAL_STATE, [
      { type: "settled", round: 1, finalTerms: { agentShare: 55, counterpartyShare: 45 } },
    ]);
    expect(state.terminal?.text).toBe("Settled in round 1: 55.0% / 45.0%");
  });

  test("deadlock produces an error-status deadlock terminal", () => {
    const state = applyEvents(INITIAL_STATE, [{ type: "deadlock", round: 8, reason: "max rounds reached" }]);
    expect(state.statusText).toBe("deadlock");
    expect(state.statusKind).toBe("error");
    expect(state.terminal).toEqual({ kind: "deadlock", text: "Deadlock in round 8: max rounds reached" });
  });

  test("does not mutate the previous state", () => {
    const before = structuredClone(INITIAL_STATE);
    applyEvents(INITIAL_STATE, [{ type: "proposal", proposal: proposal("agent-a", 1) }]);
    expect(INITIAL_STATE).toEqual(before);
  });
});
