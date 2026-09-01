import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-5";

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

// Constructed lazily so importing this module never reads ANTHROPIC_API_KEY
// (and never throws) before .env has actually been loaded / a key exists.
// `new Anthropic()` with no args resolves the key from the environment.
let _client: Anthropic | undefined;
export function getAnthropicClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}
