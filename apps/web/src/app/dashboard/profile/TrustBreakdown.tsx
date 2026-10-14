import type { TrustFactor } from "@/lib/ml/client";

/**
 * Trust-score factor breakdown.
 *
 * A bar plus a number plus a sentence, because a colour on its own tells a
 * screen reader nothing and tells a user with red-green colour vision deficiency
 * very little — and this product's users include both.
 *
 * The list is ordered by magnitude, so the things that actually moved the score
 * are read first rather than whatever order the feature table happens to use.
 */

export function TrustBreakdown({
  factors,
  score,
}: {
  factors: TrustFactor[];
  score: number;
}) {
  const sorted = [...factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  // Maximum absolute contribution, so the longest bar is always 100% width.
  const peak = Math.max(...sorted.map((f) => Math.abs(f.points)), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <p className="text-4xl font-bold tracking-tight tnum leading-none">{score}</p>
        <p className="field-help">out of 100</p>
      </div>

      <ul className="flex flex-col gap-3">
        {sorted.map((factor) => {
          const positive = factor.points >= 0;
          return (
            <li key={factor.factor} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{factor.label}</span>
                <span
                  className={`text-sm font-bold tnum ${
                    positive ? "text-leaf-700" : "text-risk-high"
                  }`}
                >
                  {positive ? "+" : ""}
                  {factor.points}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={`h-full rounded-full ${
                    positive ? "bg-leaf-500" : "bg-risk-high"
                  }`}
                  style={{
                    width: `${Math.max(2, (Math.abs(factor.points) / peak) * 100)}%`,
                    // Grow away from the left for a positive contribution and
                    // from the right for a negative one, so the bars carry the
                    // sign without needing the colour to be legible.
                    marginLeft: positive ? 0 : "auto",
                  }}
                />
              </div>

              <p className="field-help">{factor.detail}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
