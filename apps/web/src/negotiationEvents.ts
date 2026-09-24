import { NegotiationEventSchema, type NegotiationEvent } from "@negotiator/shared-types";

// Validates against the same Zod schema the gateway/orchestrator use,
// instead of trusting the WebSocket payload's shape as-is — catches both
// malformed JSON and JSON that doesn't match NegotiationEvent.
export function parseNegotiationEvent(raw: string): NegotiationEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse negotiation event JSON", err);
    return null;
  }

  const result = NegotiationEventSchema.safeParse(json);
  if (!result.success) {
    console.error("Received a negotiation event that failed schema validation", result.error);
    return null;
  }
  return result.data;
}
