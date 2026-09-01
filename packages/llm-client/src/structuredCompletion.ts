import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getAnthropicClient, getModel } from "./client";
import { StructuredCompletionError, StructuredCompletionValidationError } from "./errors";

export interface StructuredCompletionParams<T extends z.ZodTypeAny> {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  toolName: string;
  toolDescription: string;
  inputSchema: T;
  model?: string;
  maxTokens?: number;
}

export async function getStructuredCompletion<T extends z.ZodTypeAny>(
  params: StructuredCompletionParams<T>,
): Promise<z.infer<T>> {
  const client = getAnthropicClient();

  // No name passed to zodToJsonSchema, so it inlines the schema directly
  // instead of wrapping it in a $ref/definitions pair.
  const jsonSchema = zodToJsonSchema(params.inputSchema) as Record<string, unknown>;
  delete jsonSchema.$schema;

  const response = await client.messages.create({
    model: params.model ?? getModel(),
    max_tokens: params.maxTokens ?? 2048,
    system: params.systemPrompt,
    messages: params.messages,
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: jsonSchema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === params.toolName,
  );
  if (!toolUseBlock) {
    throw new StructuredCompletionError(
      `Expected forced tool_use for "${params.toolName}" but got stop_reason=${response.stop_reason}`,
    );
  }

  const parsed = params.inputSchema.safeParse(toolUseBlock.input);
  if (!parsed.success) {
    throw new StructuredCompletionValidationError(params.toolName, parsed.error);
  }
  return parsed.data;
}
