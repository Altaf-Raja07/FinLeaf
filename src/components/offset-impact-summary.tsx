/**
 * Shows the user's total impact from offset funding.
 *
 * Separate from the green points balance so the two can sit side by side
 * without confusing which is spendable and which is already spent.
 */
import { Card } from "@/components/ui";

export function OffsetImpactSummary({ impact }: {
  impact: { pointsSpent: number; kgCO2e: number; treesSupported: number };
}) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">Your total impact</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="fl-num text-[28px] font-bold leading-none text-leaf">{impact.pointsSpent.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-[13px] text-muted">Points spent</p>
        </div>
        <div>
          <p className="fl-num text-[28px] font-bold leading-none text-leaf">{impact.kgCO2e.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-[13px] text-muted">kg CO2e offset</p>
        </div>
        <div>
          <p className="fl-num text-[28px] font-bold leading-none text-leaf">{impact.treesSupported.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-[13px] text-muted">Trees supported</p>
        </div>
      </div>
    </Card>
  );
}