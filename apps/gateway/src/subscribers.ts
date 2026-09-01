import type { NegotiationEvent } from "@negotiator/shared-types";

// Structural subset of ws.WebSocket (the real type Fastify's route handler
// infers) — kept local rather than importing "ws" directly, since it's
// only a transitive dependency here, not one of this package's own.
export interface Socket {
  send(data: string): void;
  on(event: "close", listener: () => void): void;
}

// Keyed by negotiation id from the start, even though this demo only ever
// has one negotiation in flight at a time — the gateway is built to
// support concurrent runs.
const subscribersByNegotiationId = new Map<string, Set<Socket>>();
const eventHistoryByNegotiationId = new Map<string, NegotiationEvent[]>();

export function createNegotiation(id: string): void {
  eventHistoryByNegotiationId.set(id, []);
  subscribersByNegotiationId.set(id, new Set());
}

export function negotiationExists(id: string): boolean {
  return subscribersByNegotiationId.has(id);
}

export function getHistory(id: string): NegotiationEvent[] {
  return eventHistoryByNegotiationId.get(id) ?? [];
}

export function subscribe(id: string, socket: Socket): void {
  subscribersByNegotiationId.get(id)?.add(socket);
}

export function unsubscribe(id: string, socket: Socket): void {
  subscribersByNegotiationId.get(id)?.delete(socket);
}

export function broadcast(id: string, event: NegotiationEvent): void {
  eventHistoryByNegotiationId.get(id)?.push(event);
  const payload = JSON.stringify(event);
  for (const socket of subscribersByNegotiationId.get(id) ?? []) {
    socket.send(payload);
  }
}
