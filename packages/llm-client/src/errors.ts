import type { z } from "zod";

export class LlmClientError extends Error {}

export class StructuredCompletionError extends LlmClientError {
  constructor(message: string) {
    super(message);
    this.name = "StructuredCompletionError";
  }
}

export class StructuredCompletionValidationError extends LlmClientError {
  readonly toolName: string;
  readonly zodError: z.ZodError;

  constructor(toolName: string, zodError: z.ZodError) {
    super(`Tool "${toolName}" returned input that failed schema validation: ${zodError.message}`);
    this.name = "StructuredCompletionValidationError";
    this.toolName = toolName;
    this.zodError = zodError;
  }
}
