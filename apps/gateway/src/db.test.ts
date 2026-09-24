import { randomUUID } from "node:crypto";
import { describe, expect, test } from "bun:test";

// Set before importing db.ts: DB_PATH is read once at module load, and
// :memory: keeps this test isolated from the real data/negotiations.db.
process.env.NEGOTIATIONS_DB_PATH = ":memory:";
const { appendEvent, getPersistedHistory, insertNegotiation, negotiationExistsInDb } = await import("./db");

describe("negotiations persistence", () => {
  test("negotiationExistsInDb is false until inserted", () => {
    const id = randomUUID();
    expect(negotiationExistsInDb(id)).toBe(false);
    insertNegotiation(id);
    expect(negotiationExistsInDb(id)).toBe(true);
  });

  test("getPersistedHistory replays events in append order", () => {
    const id = randomUUID();
    insertNegotiation(id);
    appendEvent(id, { type: "round_started", round: 1 });
    appendEvent(id, { type: "round_started", round: 2 });

    expect(getPersistedHistory(id)).toEqual([
      { type: "round_started", round: 1 },
      { type: "round_started", round: 2 },
    ]);
  });

  test("getPersistedHistory is empty for an unknown negotiation", () => {
    expect(getPersistedHistory(randomUUID())).toEqual([]);
  });
});
