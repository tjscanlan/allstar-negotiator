import type { Proposal } from "@negotiator/shared-types";

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  return (
    <div className="card">
      <div className="card-header">
        <span>Round {proposal.round}</span>
        <span className={`card-action card-action-${proposal.action}`}>{proposal.action}</span>
      </div>
      <div className="card-share">
        {proposal.terms.agentShare}% / {proposal.terms.counterpartyShare}%
      </div>
      <p className="card-rationale">{proposal.rationale}</p>
    </div>
  );
}
