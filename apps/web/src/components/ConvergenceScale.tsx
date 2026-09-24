interface ConvergenceScaleProps {
  round: number | null;
  gap: number | null;
  converging: boolean | null;
}

export function ConvergenceScale({ round, gap, converging }: ConvergenceScaleProps) {
  // Map gap onto the 0-100% track, with 0-50 spread across the full width
  // so small demo-scale gaps are still visually legible.
  const needlePosition = gap === null ? 0 : Math.min(Math.max(gap, 0), 50) * 2;

  return (
    <section className="scale" aria-label="Convergence">
      <div className="scale-round">
        <span className="scale-label">Round</span>
        <span>{round ?? "–"}</span>
      </div>
      <div className="scale-gap">
        <span className="scale-label">Gap</span>
        <span>{gap === null ? "–" : gap.toFixed(1)}</span>
      </div>
      <div className="scale-needle-track">
        <div className="scale-needle" style={{ left: `${needlePosition}%` }} />
      </div>
      <div className="scale-converging">
        {converging === null ? "" : converging ? "converging" : "not converging yet"}
      </div>
    </section>
  );
}
