export interface Terminal {
  kind: "settled" | "deadlock";
  text: string;
}

export function VerdictStrip({ terminal }: { terminal: Terminal | null }) {
  if (!terminal) return <footer className="verdict-strip" hidden />;
  return <footer className={`verdict-strip verdict-${terminal.kind}`}>{terminal.text}</footer>;
}
