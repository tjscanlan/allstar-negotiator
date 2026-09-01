# Multi-Agent Negotiation Demo

Two Claude-backed agents with opposing goals negotiate a resource split, a
deterministic arbiter judges convergence, and a static frontend streams the
negotiation live. Built entirely in TypeScript, run on [Bun](https://bun.sh).

## Quick start

```sh
bun install
cp .env.example .env   # fill in ANTHROPIC_API_KEY

# sanity-check agents + arbiter standalone in a terminal, no HTTP/WS involved
bun run dev:orchestrator

# full app: gateway + frontend at http://localhost:3000
bun run dev:gateway
```

## Architecture

```
Frontend (static HTML/CSS/JS)
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
NegotiationEvent stream ──▶ broadcast to all WS subscribers
```

Bun workspaces monorepo:

```
/packages/shared-types   Zod schemas + TS types shared by every service
/packages/llm-client     Real Anthropic SDK wrapper, structured output via tool-use
/apps/agent-a            Claude-backed agent, one-sided goal (55% floor)
/apps/agent-b            Claude-backed agent, opposing goal (40% floor)
/apps/arbiter            Deterministic verdict logic (no LLM call)
/apps/orchestrator       Runs the round loop, emits NegotiationEvents
/apps/gateway            Fastify + WebSocket, serves /apps/web statically
/apps/web                Static HTML/CSS/JS frontend ("Negotiation Ledger")
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
- No persistence layer (Postgres/Redis) — history lives only in the
  orchestrator's in-memory loop and the gateway's per-negotiation event
  history (replayed to newly-connecting WS clients).
- Single negotiation in flight per gateway process isn't enforced — the
  subscriber map is already keyed by negotiation id, so concurrent runs
  work.
- The frontend hand-parses raw JSON off the WebSocket rather than importing
  `@negotiator/shared-types` — fine for this demo; see "Next steps" below.

## Next steps if this becomes a real app

- Have `apps/web` import `@negotiator/shared-types` and validate incoming
  events with Zod instead of hand-parsing JSON.
- Lift `app.js`'s state handling into React using the same `shared-types`
  package — the HTML/CSS structure translates directly into JSX.
- Add a persistence layer if you need replay of past negotiations across
  gateway restarts.
