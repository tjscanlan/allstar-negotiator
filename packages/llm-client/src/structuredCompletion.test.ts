import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";

// Swap the Anthropic SDK for a stub so no network call (or API key) is
// needed; each test sets what `messages.create` resolves to. The SDK is
// mocked rather than ./client because bun's module mocks are process-wide,
// and client.ts has its own tests.
const create = mock();
mock.module("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const { getStructuredCompletion } = await import("./structuredCompletion");
const { getModel } = await import("./client");
const { StructuredCompletionError, StructuredCompletionValidationError } = await import("./errors");

const schema = z.object({ answer: z.number() });

function params(overrides: Partial<Parameters<typeof getStructuredCompletion<typeof schema>>[0]> = {}) {
  return {
    systemPrompt: "be terse",
    messages: [{ role: "user" as const, content: "hi" }],
    toolName: "submit",
    toolDescription: "submit an answer",
    inputSchema: schema,
    ...overrides,
  };
}

describe("getStructuredCompletion", () => {
  beforeEach(() => create.mockReset());

  test("forces the named tool and returns its validated input", async () => {
    create.mockResolvedValue({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: "submit", id: "t1", input: { answer: 42 } }],
    });

    await expect(getStructuredCompletion(params())).resolves.toEqual({ answer: 42 });

    const request = create.mock.calls[0]![0];
    expect(request.model).toBe(getModel());
    expect(request.max_tokens).toBe(2048);
    expect(request.system).toBe("be terse");
    expect(request.tool_choice).toEqual({ type: "tool", name: "submit" });
    expect(request.tools).toHaveLength(1);
    expect(request.tools[0].name).toBe("submit");
    expect(request.tools[0].description).toBe("submit an answer");
  });

  test("sends an inlined JSON schema without a $schema key", async () => {
    create.mockResolvedValue({ content: [{ type: "tool_use", name: "submit", input: { answer: 1 } }] });

    await getStructuredCompletion(params());

    const inputSchema = create.mock.calls[0]![0].tools[0].input_schema;
    expect(inputSchema.$schema).toBeUndefined();
    expect(inputSchema.$ref).toBeUndefined();
    expect(inputSchema.type).toBe("object");
    expect(inputSchema.properties.answer).toEqual({ type: "number" });
  });

  test("honours explicit model and maxTokens overrides", async () => {
    create.mockResolvedValue({ content: [{ type: "tool_use", name: "submit", input: { answer: 1 } }] });

    await getStructuredCompletion(params({ model: "other-model", maxTokens: 10 }));

    const request = create.mock.calls[0]![0];
    expect(request.model).toBe("other-model");
    expect(request.max_tokens).toBe(10);
  });

  test("skips text blocks and tool_use blocks for other tools", async () => {
    create.mockResolvedValue({
      content: [
        { type: "text", text: "thinking out loud" },
        { type: "tool_use", name: "other", input: { answer: 0 } },
        { type: "tool_use", name: "submit", input: { answer: 7 } },
      ],
    });

    await expect(getStructuredCompletion(params())).resolves.toEqual({ answer: 7 });
  });

  test("throws StructuredCompletionError when the named tool was not called", async () => {
    create.mockResolvedValue({ stop_reason: "max_tokens", content: [{ type: "text", text: "..." }] });

    const promise = getStructuredCompletion(params());
    await expect(promise).rejects.toBeInstanceOf(StructuredCompletionError);
    await expect(promise).rejects.toThrow(/stop_reason=max_tokens/);
  });

  test("throws StructuredCompletionValidationError when tool input fails the schema", async () => {
    create.mockResolvedValue({ content: [{ type: "tool_use", name: "submit", input: { answer: "nope" } }] });

    const err = await getStructuredCompletion(params()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StructuredCompletionValidationError);
    const validationError = err as InstanceType<typeof StructuredCompletionValidationError>;
    expect(validationError.toolName).toBe("submit");
    expect(validationError.zodError.issues[0]!.path).toEqual(["answer"]);
    expect(validationError.name).toBe("StructuredCompletionValidationError");
  });

  test("propagates errors from the Anthropic client", async () => {
    create.mockRejectedValue(new Error("401 unauthorized"));

    await expect(getStructuredCompletion(params())).rejects.toThrow("401 unauthorized");
  });
});
