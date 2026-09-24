import type { NegotiationEvent } from "@negotiator/shared-types";
import { appendEvent, getPersistedHistory, insertNegotiation, negotiationExistsInDb } from "./db";

// Structural subset of ws.WebSocket (the real type Fastify's route handler
// infers) — kept local rather than importing "ws" directly, since it's
// only a transitive dependency here, not one of this package's own.
export interface Socket {
  send(data: string): void;
  on(event: "close", listener: () => void): void;
}

// Live sockets and subscriber sets can't survive a restart anyway, so only
// these stay in-memory. Existence and event history are backed by SQLite
// (./db.ts) so a negotiation started before a gateway restart can still be
// reconnected to and replayed — this is what lets negotiationExists/
// getHistory below work for a negotiation this process never created.
//
// Keyed by negotiation id from the start, even though this demo only ever
// has one negotiation in flight at a time — the gateway is built to
// support concurrent runs.
const subscribersByNegotiationId = new Map<string, Set<Socket>>();

export function createNegotiation(id: string): void {
  insertNegotiation(id);
  subscribersByNegotiationId.set(id, new Set());
}

export function negotiationExists(id: string): boolean {
  return negotiationExistsInDb(id);
}

export function getHistory(id: string): NegotiationEvent[] {
  return getPersistedHistory(id);
}

export function subscribe(id: string, socket: Socket): void {
  if (!subscribersByNegotiationId.has(id)) subscribersByNegotiationId.set(id, new Set());
  subscribersByNegotiationId.get(id)!.add(socket);
}

export function unsubscribe(id: string, socket: Socket): void {
  subscribersByNegotiationId.get(id)?.delete(socket);
}

export function broadcast(id: string, event: NegotiationEvent): void {
  appendEvent(id, event);
  const payload = JSON.stringify(event);
  for (const socket of subscribersByNegotiationId.get(id) ?? []) {
    socket.send(payload);
  }
}
