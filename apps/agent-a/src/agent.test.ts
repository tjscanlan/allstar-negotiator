import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ProposalSchema, type Proposal } from "@negotiator/shared-types";

// Stand in for the real LLM call; each test sets what the "model" returns.
const getStructuredCompletion = mock();
mock.module("@negotiator/llm-client", () => ({ getStructuredCompletion }));

const { proposeOpeningTerms, reactToProposal } = await import("./agent");
const { SYSTEM_PROMPT } = await import("./systemPrompt");

function modelOutput(overrides: Partial<Proposal> = {}): Proposal {
  return {
    agentId: "agent-b",
    round: 99,
    terms: { agentShare: 70, counterpartyShare: 30 },
    rationale: "model rationale",
    action: "propose",
    ...overrides,
  };
}

describe("agent-a", () => {
  beforeEach(() => {
    getStructuredCompletion.mockReset();
    getStructuredCompletion.mockResolvedValue(modelOutput());
  });

  test("proposeOpeningTerms requests a submit_proposal tool call with the Agent A prompt", async () => {
    await proposeOpeningTerms(1);

    const params = getStructuredCompletion.mock.calls[0]![0];
    expect(params.systemPrompt).toBe(SYSTEM_PROMPT);
    expect(params.toolName).toBe("submit_proposal");
    expect(params.inputSchema).toBe(ProposalSchema);
    expect(params.messages).toEqual([{ role: "user", content: "Round 1: propose your opening terms." }]);
  });

  test("overrides agentId and round from the model output, keeping its opinion", async () => {
    const result = await proposeOpeningTerms(3);

    expect(result).toEqual({
      agentId: "agent-a",
      round: 3,
      terms: { agentShare: 70, counterpartyShare: 30 },
      rationale: "model rationale",
      action: "propose",
    });
  });

  test("reactToProposal restates own history and the counterparty's last proposal", async () => {
    const counter = modelOutput({ agentId: "agent-b", round: 1, rationale: "their move" });
    const history = [modelOutput({ agentId: "agent-a", round: 1, rationale: "my first move" })];

    const result = await reactToProposal(2, counter, history);

    const content: string = getStructuredCompletion.mock.calls[0]![0].messages[0].content;
    expect(content).toStartWith("Round 2:");
    expect(content).toContain(JSON.stringify(history, null, 2));
    expect(content).toContain(JSON.stringify(counter, null, 2));
    expect(content.indexOf("my first move")).toBeLessThan(content.indexOf("their move"));
    expect(result.agentId).toBe("agent-a");
    expect(result.round).toBe(2);
  });

  test("propagates LLM failures", async () => {
    getStructuredCompletion.mockRejectedValue(new Error("rate limited"));
    await expect(proposeOpeningTerms(1)).rejects.toThrow("rate limited");
  });

  test("system prompt states the 55% floor", () => {
    expect(SYSTEM_PROMPT).toContain("Your minimum acceptable share is 55%");
    expect(SYSTEM_PROMPT).toContain('"submit_proposal"');
  });
});
