import { getStructuredCompletion } from "@negotiator/llm-client";
import { ProposalSchema, type Proposal } from "@negotiator/shared-types";
import { SYSTEM_PROMPT } from "./systemPrompt";

const AGENT_ID = "agent-b" as const;
const TOOL_NAME = "submit_proposal";
const TOOL_DESCRIPTION =
  "Submit this round's negotiation proposal: your requested share, your offer to the counterparty, your rationale, and whether you are proposing, accepting, or rejecting.";

/**
 * `agentId` and `round` are overridden from the function args after
 * validation rather than trusted from the model's output — only
 * `terms`/`rationale`/`action` are treated as the model's actual opinion.
 */
function finalizeProposal(round: number, modelOutput: Proposal): Proposal {
  return { ...modelOutput, agentId: AGENT_ID, round };
}

export async function proposeOpeningTerms(round: number): Promise<Proposal> {
  const result = await getStructuredCompletion({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Round ${round}: propose your opening terms.` }],
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: ProposalSchema,
  });
  return finalizeProposal(round, result);
}

/**
 * Both agents act simultaneously each round — `counterProposal` is the
 * counterparty's *previous* round's proposal, never the current round's
 * (which doesn't exist yet, since neither agent awaits the other). Do not
 * "fix" this into a sequential call; it's a deliberate demo simplification.
 */
export async function reactToProposal(round: number, counterProposal: Proposal): Promise<Proposal> {
  const result = await getStructuredCompletion({
    systemPrompt: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Round ${round}: the counterparty's most recent proposal was:\n${JSON.stringify(
          counterProposal,
          null,
          2,
        )}\n\nRespond with your proposal for this round.`,
      },
    ],
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: ProposalSchema,
  });
  return finalizeProposal(round, result);
}
