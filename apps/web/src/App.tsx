import { useCallback, useEffect, useReducer, useRef } from "react";
import type { NegotiationEvent, Proposal } from "@negotiator/shared-types";
import { AgentColumn } from "./components/AgentColumn";
import { ConvergenceScale } from "./components/ConvergenceScale";
import { TopBar, type StatusKind } from "./components/TopBar";
import { VerdictStrip, type Terminal } from "./components/VerdictStrip";
import { parseNegotiationEvent } from "./negotiationEvents";

interface LedgerState {
  statusText: string;
  statusKind: StatusKind;
  busy: boolean;
  round: number | null;
  gap: number | null;
  converging: boolean | null;
  proposalsA: Proposal[];
  proposalsB: Proposal[];
  terminal: Terminal | null;
}

const INITIAL_STATE: LedgerState = {
  statusText: "idle",
  statusKind: "idle",
  busy: false,
  round: null,
  gap: null,
  converging: null,
  proposalsA: [],
  proposalsB: [],
  terminal: null,
};

type Action =
  | { type: "start" }
  | { type: "connected" }
  | { type: "closed" }
  | { type: "connectionError" }
  | { type: "startFailed" }
  | { type: "negotiationEvent"; event: NegotiationEvent };

function reducer(state: LedgerState, action: Action): LedgerState {
  switch (action.type) {
    case "start":
      return { ...INITIAL_STATE, busy: true, statusText: "starting…" };
    case "connected":
      return { ...state, statusText: "connected", statusKind: "connected" };
    case "closed":
      return { ...state, busy: false };
    case "connectionError":
      return { ...state, statusText: "connection error", statusKind: "error" };
    case "startFailed":
      return { ...state, busy: false, statusText: "failed to start", statusKind: "error" };
    case "negotiationEvent":
      return applyNegotiationEvent(state, action.event);
  }
}

function applyNegotiationEvent(state: LedgerState, event: NegotiationEvent): LedgerState {
  switch (event.type) {
    case "round_started":
      return { ...state, round: event.round };
    case "proposal":
      return event.proposal.agentId === "agent-a"
        ? { ...state, proposalsA: [event.proposal, ...state.proposalsA] }
        : { ...state, proposalsB: [event.proposal, ...state.proposalsB] };
    case "verdict":
      return {
        ...state,
        round: event.verdict.round,
        gap: event.verdict.gap,
        converging: event.verdict.converging,
      };
    case "settled":
      return {
        ...state,
        statusText: "settled",
        statusKind: "connected",
        terminal: {
          kind: "settled",
          text: `Settled in round ${event.round}: ${event.finalTerms.agentShare.toFixed(1)}% / ${event.finalTerms.counterpartyShare.toFixed(1)}%${
            event.reason ? ` — ${event.reason}` : ""
          }`,
        },
      };
    case "deadlock":
      return {
        ...state,
        statusText: "deadlock",
        statusKind: "error",
        terminal: { kind: "deadlock", text: `Deadlock in round ${event.round}: ${event.reason}` },
      };
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  const handleStart = useCallback(async () => {
    dispatch({ type: "start" });

    try {
      const response = await fetch("/negotiations", { method: "POST" });
      if (!response.ok) throw new Error(`POST /negotiations failed: ${response.status}`);
      const { id } = (await response.json()) as { id: string };

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}/negotiations/${id}/stream`);
      wsRef.current = ws;

      ws.addEventListener("open", () => dispatch({ type: "connected" }));
      ws.addEventListener("message", (msg) => {
        const event = parseNegotiationEvent(msg.data as string);
        if (event) dispatch({ type: "negotiationEvent", event });
      });
      ws.addEventListener("close", () => dispatch({ type: "closed" }));
      ws.addEventListener("error", () => dispatch({ type: "connectionError" }));
    } catch (err) {
      console.error(err);
      dispatch({ type: "startFailed" });
    }
  }, []);

  return (
    <>
      <TopBar statusText={state.statusText} statusKind={state.statusKind} busy={state.busy} onStart={handleStart} />
      <main className="ledger">
        <AgentColumn columnId="column-a" label="Agent A" floorNote="(55% floor)" proposals={state.proposalsA} />
        <ConvergenceScale round={state.round} gap={state.gap} converging={state.converging} />
        <AgentColumn columnId="column-b" label="Agent B" floorNote="(40% floor)" proposals={state.proposalsB} />
      </main>
      <VerdictStrip terminal={state.terminal} />
    </>
  );
}
