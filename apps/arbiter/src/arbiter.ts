import type { ArbiterVerdict, Proposal } from "@negotiator/shared-types";

export const MAX_ROUNDS = 8;
export const SETTLE_THRESHOLD_GAP = 5;
export const STALL_ROUNDS = 3;

export interface ArbiterState {
  /** Gap from the prior round, or null on round 1 (nothing to compare yet). */
  previousGap: number | null;
  /** Consecutive rounds where the gap did not shrink. */
  stallCount: number;
}

export const INITIAL_ARBITER_STATE: ArbiterState = { previousGap: null, stallCount: 0 };

export interface EvaluateRoundResult {
  verdict: ArbiterVerdict;
  nextState: ArbiterState;
}

/**
 * Reconciles two independently-framed, simultaneous proposals: each agent
 * states a share for itself and an offer for the counterparty, and the two
 * proposals don't sum to 100 by construction. `gap` is the average of both
 * cross-checks (how far A's self-ask is from what B offers A, and vice
 * versa) — zero when the proposals are mirror-consistent, growing as they
 * diverge.
 */
function computeGap(proposalA: Proposal, proposalB: Proposal): number {
  const gapFromA = Math.abs(proposalA.terms.agentShare - proposalB.terms.counterpartyShare);
  const gapFromB = Math.abs(proposalB.terms.agentShare - proposalA.terms.counterpartyShare);
  return (gapFromA + gapFromB) / 2;
}

export function evaluateRound(
  round: number,
  proposalA: Proposal,
  proposalB: Proposal,
  state: ArbiterState,
): EvaluateRoundResult {
  const gap = computeGap(proposalA, proposalB);
  const isFirstRound = state.previousGap === null;
  const converging = !isFirstRound && gap < (state.previousGap as number);

  const stallCount = isFirstRound ? 0 : converging ? 0 : state.stallCount + 1;

  const mutualAccept = proposalA.action === "accept" && proposalB.action === "accept";
  const settled = gap <= SETTLE_THRESHOLD_GAP || mutualAccept;

  const maxRoundsReached = round >= MAX_ROUNDS && !settled;
  const stalled = stallCount >= STALL_ROUNDS;
  const deadlock = !settled && (maxRoundsReached || stalled);

  let reason: string | undefined;
  if (settled) {
    reason = mutualAccept ? "both agents accepted" : "gap closed within settlement threshold";
  } else if (deadlock) {
    reason = maxRoundsReached
      ? "max rounds reached without convergence"
      : `gap has not shrunk for ${STALL_ROUNDS} consecutive rounds`;
  }

  return {
    verdict: { round, converging, gap, settled, deadlock, reason },
    nextState: { previousGap: gap, stallCount },
  };
}
