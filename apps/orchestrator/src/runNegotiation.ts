import * as agentA from "@negotiator/agent-a";
import * as agentB from "@negotiator/agent-b";
import { evaluateRound, INITIAL_ARBITER_STATE, MAX_ROUNDS, type ArbiterState } from "@negotiator/arbiter";
import type { NegotiationEvent, Proposal, ProposalTerms } from "@negotiator/shared-types";

/**
 * Reconciles the two agents' final, independently-framed proposals into a
 * single settlement view, from Agent A's perspective: A's share is the
 * average of what A asked for itself and what B was willing to give A
 * (and symmetrically for B's share) — the same cross-check the arbiter
 * uses to compute `gap`.
 */
function reconcileFinalTerms(proposalA: Proposal, proposalB: Proposal): ProposalTerms {
  const agentShare = (proposalA.terms.agentShare + proposalB.terms.counterpartyShare) / 2;
  const counterpartyShare = (proposalB.terms.agentShare + proposalA.terms.counterpartyShare) / 2;
  return { agentShare, counterpartyShare, notes: "reconciled from both agents' final proposals" };
}

/**
 * Drives the full round loop and reports every step through `emit`. Has
 * zero HTTP/WS dependencies so it can run standalone (see cli.ts) as well
 * as inside the gateway.
 */
export async function runNegotiation(emit: (event: NegotiationEvent) => void): Promise<void> {
  let arbiterState: ArbiterState = INITIAL_ARBITER_STATE;
  let lastProposalA: Proposal | null = null;
  let lastProposalB: Proposal | null = null;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    emit({ type: "round_started", round });

    // Both agents act in the same Promise.all — neither awaits the other,
    // which is what structurally enforces "simultaneous, not sequential":
    // each only ever sees the counterparty's *previous* round's proposal.
    const proposalAPromise: Promise<Proposal> =
      round === 1 ? agentA.proposeOpeningTerms(round) : agentA.reactToProposal(round, lastProposalB!);
    const proposalBPromise: Promise<Proposal> =
      round === 1 ? agentB.proposeOpeningTerms(round) : agentB.reactToProposal(round, lastProposalA!);
    const [proposalA, proposalB] = await Promise.all([proposalAPromise, proposalBPromise]);

    emit({ type: "proposal", proposal: proposalA });
    emit({ type: "proposal", proposal: proposalB });

    const { verdict, nextState } = evaluateRound(round, proposalA, proposalB, arbiterState);
    arbiterState = nextState;
    emit({ type: "verdict", verdict });

    if (verdict.settled) {
      emit({
        type: "settled",
        round,
        finalTerms: reconcileFinalTerms(proposalA, proposalB),
        reason: verdict.reason,
      });
      return;
    }
    if (verdict.deadlock) {
      emit({ type: "deadlock", round, reason: verdict.reason ?? "max rounds reached" });
      return;
    }

    lastProposalA = proposalA;
    lastProposalB = proposalB;
  }
}
