import path from "node:path";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import Fastify from "fastify";
import { negotiationRoutes } from "./routes/negotiations";

// Plain logging only — pino's pretty-print transport runs in a worker
// thread, which has had rough edges under Bun; keep it off for the demo.
const app = Fastify({ logger: true });

await app.register(fastifyStatic, {
  root: path.join(import.meta.dirname, "../../web"),
});
await app.register(fastifyWebsocket);
await app.register(negotiationRoutes);

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: "0.0.0.0" });
