import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { NegotiationEvent } from "@negotiator/shared-types";

process.env.NEGOTIATIONS_DB_PATH = ":memory:";

// The real orchestrator would call Claude; each test decides what it does.
const runNegotiation = mock<(emit: (event: NegotiationEvent) => void) => Promise<void>>();
mock.module("@negotiator/orchestrator", () => ({ runNegotiation }));

const { default: Fastify } = await import("fastify");
const { default: fastifyWebsocket } = await import("@fastify/websocket");
const { negotiationRoutes } = await import("./negotiations");
const { getHistory, negotiationExists } = await import("../subscribers");

const app = Fastify({ forceCloseConnections: true });
await app.register(fastifyWebsocket);
await app.register(negotiationRoutes);

// Real listener on an ephemeral port: @fastify/websocket's injectWS relies
// on ws internals that Bun's ws shim doesn't support.
let baseWsUrl = "";
beforeAll(async () => {
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  baseWsUrl = address.replace(/^http/, "ws");
});
afterAll(() => app.close());
beforeEach(() => runNegotiation.mockReset());

async function startNegotiation(): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/negotiations" });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
}

describe("POST /negotiations", () => {
  test("creates a negotiation, returns its id, and starts the orchestrator", async () => {
    runNegotiation.mockResolvedValue(undefined);

    const id = await startNegotiation();

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(negotiationExists(id)).toBe(true);
    expect(runNegotiation).toHaveBeenCalledTimes(1);
  });

  test("persists every event the orchestrator emits", async () => {
    runNegotiation.mockImplementation(async (emit) => {
      emit({ type: "round_started", round: 1 });
      emit({ type: "deadlock", round: 1, reason: "test" });
    });

    const id = await startNegotiation();

    expect(getHistory(id)).toEqual([
      { type: "round_started", round: 1 },
      { type: "deadlock", round: 1, reason: "test" },
    ]);
  });

  test("turns an orchestrator failure into a synthetic deadlock event", async () => {
    runNegotiation.mockRejectedValue(new Error("missing ANTHROPIC_API_KEY"));

    const id = await startNegotiation();
    await Bun.sleep(0); // let the rejected promise's .catch run

    expect(getHistory(id)).toEqual([
      { type: "deadlock", round: 0, reason: "orchestrator error: missing ANTHROPIC_API_KEY" },
    ]);
  });
});

function openStream(id: string) {
  const ws = new WebSocket(`${baseWsUrl}/negotiations/${id}/stream`);
  const received: NegotiationEvent[] = [];
  ws.addEventListener("message", (msg) => received.push(JSON.parse(String(msg.data))));
  const opened = new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
  const closed = new Promise<number>((resolve) => ws.addEventListener("close", (e) => resolve(e.code)));
  return { ws, received, opened, closed };
}

async function waitFor(condition: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    await Bun.sleep(5);
  }
}

describe("WS /negotiations/:id/stream", () => {
  test("closes with 4004 for an unknown negotiation id", async () => {
    const { closed } = openStream("does-not-exist");
    expect(await closed).toBe(4004);
  });

  test("replays history first, then streams live events", async () => {
    let emit!: (event: NegotiationEvent) => void;
    let finish!: () => void;
    runNegotiation.mockImplementation(
      (e) =>
        new Promise<void>((resolve) => {
          emit = e;
          finish = resolve;
        }),
    );

    const id = await startNegotiation();
    emit({ type: "round_started", round: 1 });

    const { ws, received } = openStream(id);
    await waitFor(() => received.length === 1); // replayed history

    emit({ type: "round_started", round: 2 }); // live
    await waitFor(() => received.length === 2);
    finish();
    ws.close();

    expect(received).toEqual([
      { type: "round_started", round: 1 },
      { type: "round_started", round: 2 },
    ]);
  });
});
