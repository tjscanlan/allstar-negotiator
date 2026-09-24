/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, spyOn, test, type Mock } from "bun:test";
import { parseNegotiationEvent } from "./negotiationEvents";

describe("parseNegotiationEvent", () => {
  let consoleError: Mock<typeof console.error>;
  beforeEach(() => {
    consoleError = spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  test("returns a schema-valid event", () => {
    expect(parseNegotiationEvent('{"type":"round_started","round":2}')).toEqual({ type: "round_started", round: 2 });
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("returns null and logs on malformed JSON", () => {
    expect(parseNegotiationEvent("{not json")).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]![0]).toContain("parse");
  });

  test("returns null and logs on JSON that doesn't match the schema", () => {
    expect(parseNegotiationEvent('{"type":"round_started","round":"two"}')).toBeNull();
    expect(parseNegotiationEvent('{"type":"mystery"}')).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError.mock.calls[0]![0]).toContain("schema validation");
  });
});
