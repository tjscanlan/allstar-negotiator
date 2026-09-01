import { randomUUID } from "node:crypto";
import { runNegotiation } from "@negotiator/orchestrator";
import type { FastifyInstance } from "fastify";
import { broadcast, createNegotiation, getHistory, negotiationExists, subscribe, unsubscribe } from "../subscribers";

export async function negotiationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/negotiations", async (_req, reply) => {
    const id = randomUUID();
    createNegotiation(id);

    // Fire-and-forget: the request returns immediately with the id, the
    // negotiation streams over the WS route as it progresses. A failure
    // here (e.g. no ANTHROPIC_API_KEY set) is turned into a synthetic
    // `deadlock` event rather than an unhandled rejection, so a connected
    // client sees something instead of silence.
    runNegotiation((event) => broadcast(id, event)).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err, negotiationId: id }, "negotiation failed");
      broadcast(id, { type: "deadlock", round: 0, reason: `orchestrator error: ${message}` });
    });

    return reply.code(201).send({ id });
  });

  app.get("/negotiations/:id/stream", { websocket: true }, (socket, req) => {
    const { id } = req.params as { id: string };

    if (!negotiationExists(id)) {
      socket.close(4004, "unknown negotiation id");
      return;
    }

    // Replay the full event history before subscribing live: there's an
    // inherent race between the POST response and the WS upgrade
    // completing, during which early events could otherwise be missed.
    for (const event of getHistory(id)) {
      socket.send(JSON.stringify(event));
    }

    subscribe(id, socket);
    socket.on("close", () => unsubscribe(id, socket));
  });
}
