import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import type { NegotiationEvent } from "@negotiator/shared-types";

// SQLite file, not Postgres/Redis — this is a demo, and bun:sqlite is
// built into the runtime already, so it's the lowest-footprint way to
// survive a gateway restart. Swap for a real DB if this becomes a real app.
const DB_PATH = process.env.NEGOTIATIONS_DB_PATH ?? `${import.meta.dirname}/../data/negotiations.db`;
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS negotiations (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS negotiation_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    negotiation_id TEXT NOT NULL REFERENCES negotiations(id),
    payload TEXT NOT NULL
  );
`);

const insertNegotiationStmt = db.prepare("INSERT INTO negotiations (id, created_at) VALUES (?, ?)");
const negotiationExistsStmt = db.prepare("SELECT 1 FROM negotiations WHERE id = ?");
const insertEventStmt = db.prepare("INSERT INTO negotiation_events (negotiation_id, payload) VALUES (?, ?)");
const getEventsStmt = db.prepare(
  "SELECT payload FROM negotiation_events WHERE negotiation_id = ? ORDER BY event_id ASC",
);

export function insertNegotiation(id: string): void {
  insertNegotiationStmt.run(id, Date.now());
}

export function negotiationExistsInDb(id: string): boolean {
  return negotiationExistsStmt.get(id) !== null;
}

export function appendEvent(id: string, event: NegotiationEvent): void {
  insertEventStmt.run(id, JSON.stringify(event));
}

export function getPersistedHistory(id: string): NegotiationEvent[] {
  const rows = getEventsStmt.all(id) as { payload: string }[];
  return rows.map((row) => JSON.parse(row.payload) as NegotiationEvent);
}
