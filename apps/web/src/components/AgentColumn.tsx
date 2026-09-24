import type { Proposal } from "@negotiator/shared-types";
import { ProposalCard } from "./ProposalCard";

interface AgentColumnProps {
  columnId: string;
  label: string;
  floorNote: string;
  proposals: Proposal[];
}

// `proposals` is newest-first (App.tsx unshifts), matching the original
// vanilla-JS version's `container.prepend(card)` behavior.
export function AgentColumn({ columnId, label, floorNote, proposals }: AgentColumnProps) {
  return (
    <section className="column" id={columnId} aria-label={label}>
      <h2>
        {label} <span className="floor-note">{floorNote}</span>
      </h2>
      <div className="cards">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.round} proposal={proposal} />
        ))}
      </div>
    </section>
  );
}
