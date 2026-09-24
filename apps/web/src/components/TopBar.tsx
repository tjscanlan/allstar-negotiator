export type StatusKind = "idle" | "connected" | "error";

interface TopBarProps {
  statusText: string;
  statusKind: StatusKind;
  busy: boolean;
  onStart: () => void;
}

export function TopBar({ statusText, statusKind, busy, onStart }: TopBarProps) {
  return (
    <header className="topbar">
      <h1>Negotiation Ledger</h1>
      <div className="topbar-controls">
        <span className={`status status-${statusKind}`}>{statusText}</span>
        <button id="start-btn" type="button" disabled={busy} onClick={onStart}>
          Start negotiation
        </button>
      </div>
    </header>
  );
}
