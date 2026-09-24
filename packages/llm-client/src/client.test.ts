import { afterEach, describe, expect, test } from "bun:test";
import { getModel } from "./client";

describe("getModel", () => {
  const original = process.env.ANTHROPIC_MODEL;

  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = original;
  });

  test("falls back to the default model when ANTHROPIC_MODEL is unset", () => {
    delete process.env.ANTHROPIC_MODEL;
    expect(getModel()).toBe("claude-sonnet-5");
  });

  test("falls back to the default model when ANTHROPIC_MODEL is blank", () => {
    process.env.ANTHROPIC_MODEL = "   ";
    expect(getModel()).toBe("claude-sonnet-5");
  });

  test("uses a trimmed ANTHROPIC_MODEL override", () => {
    process.env.ANTHROPIC_MODEL = "  claude-opus-5-5 ";
    expect(getModel()).toBe("claude-opus-5-5");
  });
});
