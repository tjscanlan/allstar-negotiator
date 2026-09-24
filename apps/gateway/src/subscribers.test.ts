import { randomUUID } from "node:crypto";
import { describe, expect, test } from "bun:test";
import type { NegotiationEvent } from "@negotiator/shared-types";

// Same as db.test.ts: must be set before ./db is (transitively) imported.
process.env.NEGOTIATIONS_DB_PATH = ":memory:";
const { broadcast, createNegotiation, getHistory, negotiationExists, subscribe, unsubscribe } = await import(
  "./subscribers"
);

function fakeSocket() {
  const sent: string[] = [];
  return { sent, send: (data: string) => void sent.push(data), on: () => {} };
}

const roundStarted: NegotiationEvent = { type: "round_started", round: 1 };

describe("subscribers", () => {
  test("createNegotiation makes the id known", () => {
    const id = randomUUID();
    expect(negotiationExists(id)).toBe(false);
    createNegotiation(id);
    expect(negotiationExists(id)).toBe(true);
  });

  test("broadcast sends serialized events to every subscriber and persists them", () => {
    const id = randomUUID();
    createNegotiation(id);
    const first = fakeSocket();
    const second = fakeSocket();
    subscribe(id, first);
    subscribe(id, second);

    broadcast(id, roundStarted);

    expect(first.sent).toEqual([JSON.stringify(roundStarted)]);
    expect(second.sent).toEqual([JSON.stringify(roundStarted)]);
    expect(getHistory(id)).toEqual([roundStarted]);
  });

  test("unsubscribed sockets stop receiving events", () => {
    const id = randomUUID();
    createNegotiation(id);
    const socket = fakeSocket();
    subscribe(id, socket);
    unsubscribe(id, socket);

    broadcast(id, roundStarted);

    expect(socket.sent).toEqual([]);
    expect(getHistory(id)).toEqual([roundStarted]);
  });

  test("broadcasts are scoped to their own negotiation", () => {
    const idA = randomUUID();
    const idB = randomUUID();
    createNegotiation(idA);
    createNegotiation(idB);
    const socketA = fakeSocket();
    const socketB = fakeSocket();
    subscribe(idA, socketA);
    subscribe(idB, socketB);

    broadcast(idA, roundStarted);

    expect(socketA.sent).toHaveLength(1);
    expect(socketB.sent).toEqual([]);
    expect(getHistory(idB)).toEqual([]);
  });

  test("subscribing the same socket twice delivers each event once", () => {
    const id = randomUUID();
    createNegotiation(id);
    const socket = fakeSocket();
    subscribe(id, socket);
    subscribe(id, socket);

    broadcast(id, roundStarted);

    expect(socket.sent).toHaveLength(1);
  });

  test("unsubscribe on an unknown negotiation is a no-op", () => {
    expect(() => unsubscribe(randomUUID(), fakeSocket())).not.toThrow();
  });
});
