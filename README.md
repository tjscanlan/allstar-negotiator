# Multi-Agent Negotiation Demo

Two Claude-backed agents with opposing goals negotiate a resource split, a
deterministic arbiter judges convergence, and a React frontend streams the
negotiation live. Built entirely in TypeScript, run on [Bun](https://bun.sh).

## Quick start

```sh
bun install
cp .env.example .env   # fill in ANTHROPIC_API_KEY

# sanity-check agents + arbiter standalone in a terminal, no HTTP/WS involved
bun run dev:orchestrator

# full app: builds the frontend, then gateway + frontend at http://localhost:3000
bun run dev:gateway
```

`dev:gateway` rebuilds the frontend (`bun run build:web`) before starting the
server every time, so editing `apps/web/src` just needs a restart — there's
no watch/hot-reload loop for the frontend in this demo.

## Architecture

```
Frontend (React, built with `bun build`)
        │  POST /negotiations  →  starts a run
        │  WS   /negotiations/:id/stream  →  live events
        ▼
Gateway (Fastify)
        │  drives, per round:
        ▼
Orchestrator  ──calls──▶  Agent A (Claude)
        │            ──calls──▶  Agent B (Claude)
        │            ──calls──▶  Arbiter (deterministic)
        ▼
NegotiationEvent stream ──▶ persisted to SQLite + broadcast to all WS subscribers
```

Every event is persisted to `apps/gateway/data/negotiations.db` (SQLite, via
`bun:sqlite`) as it's emitted, so a negotiation survives a gateway restart —
reconnecting to `/negotiations/:id/stream` replays its full history from
disk, not just from this process's memory.

Bun workspaces monorepo:

```
/packages/shared-types   Zod schemas + TS types shared by every service
/packages/llm-client     Real Anthropic SDK wrapper, structured output via tool-use
/apps/agent-a            Claude-backed agent, one-sided goal (55% floor)
/apps/agent-b            Claude-backed agent, opposing goal (40% floor)
/apps/arbiter            Deterministic verdict logic (no LLM call)
/apps/orchestrator       Runs the round loop, emits NegotiationEvents
/apps/gateway            Fastify + WebSocket, serves /apps/web statically
/apps/web                React frontend ("Negotiation Ledger"), built with `bun build`
```

Every workspace script runs via `bun run --filter <name> <script>`; the root
`bun run typecheck` fans out `tsc --noEmit` across every package.

## Known simplifications (intentional, for demo scope) — do not "fix" these

- Both agents act simultaneously each round rather than seeing each other's
  current-round move before responding — this avoids ordering complexity
  for a demo.
- Arbiter is pure math (share-gap threshold + stall detection), not an LLM
  call — cheaper and deterministic; swap in a Claude-based arbiter if you
  want it to reason about non-numeric rationale quality.
- Single negotiation in flight per gateway process isn't enforced — the
  subscriber map is already keyed by negotiation id, so concurrent runs
  work.
- No watch/hot-reload loop for the frontend — `apps/web`'s build step
  (`bun run build:web`) runs once, on `dev:gateway` startup; restart it
  after editing `apps/web/src`.

## Next steps if this becomes a real app

- Swap the gateway's SQLite persistence (`apps/gateway/src/db.ts`) for
  Postgres/Redis if you need it to survive more than a single machine, or
  add retention/cleanup — right now `data/negotiations.db` grows forever.
- Add a frontend dev loop (`bun build --watch`, or a real dev server) so
  `apps/web/src` changes don't require restarting the gateway.
