import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTransactions } from "@/lib/queries";
import { CARBON_FACTORS, estimateCarbon } from "@/lib/carbon";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * How a carbon estimate is produced, and what it cannot tell you.
 *
 * The worked example uses the proposal's own arithmetic on a real transaction
 * from this user's history, so the number on screen is the same number the app
 * computed when the payment was recorded.
 */

export default async function CarbonDetailsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // The largest fuel purchase is the clearest worked example, and it is a real row.
  const { rows } = await getTransactions(user.id, { limit: 60, category: "fuel" });
  const example = rows.find((r) => r.co2eKg !== null && r.co2eKg > 0);
  const worked = example ? estimateCarbon("fuel", example.amount) : null;

  // Per-transaction table, real rows with their real factors.
  const { rows: recent } = await getTransactions(user.id, { limit: 60 });
  const withCarbon = recent.filter((r) => r.co2eKg !== null && r.co2eKg > 0).slice(0, 8);

  return (
    <AppShell pathname="/sustainability" userName={user.fullName}>
      <PageHeader
        title="Why this estimate?"
        subtitle="How a single transaction turns into kilograms of CO2e"
      />

      <Card className="p-5">
        <h2 className="text-[17px] font-semibold">
          Worked example{worked ? ` - ${example?.merchant}` : ""}
        </h2>

        {!worked ? (
          <p className="mt-3 text-[14px] text-muted">
            No fuel purchase yet, so there is nothing to work through. Pay for fuel and the estimate
            will appear here with its arithmetic.
          </p>
        ) : (
          <ol className="mt-4">
            {[
              { n: 1, label: "Amount spent", value: formatMoney(worked.amountPaise, { sign: "never" }), unit: "rupees" },
              {
                n: 2,
                label: "Category factor",
                value: String(worked.kgPer100Rupees),
                unit: "kg CO2 per 100 rupees",
              },
              { n: 3, label: "Estimated footprint", value: worked.co2eKg.toFixed(1), unit: "kg CO2e" },
            ].map((step, index) => (
              <li
                key={step.n}
                className={`flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-4 ${
                  index < 2 ? "border-b border-border" : ""
                }`}
              >
                <span className="sm:w-56 sm:shrink-0">
                  <span className="block text-[15px] font-semibold">{step.label}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span
                    className={`fl-num font-semibold ${step.n === 3 ? "text-[24px] text-leaf" : "text-[18px]"}`}
                  >
                    {step.value}
                  </span>
                  <span className="text-[13px] text-muted">{step.unit}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-2">
          <Notice tone="neutral">
            These are category averages. Real emissions depend on the exact fuel, distance travelled,
            and energy source, which this system does not collect. Treat every figure here as an
            estimate.
          </Notice>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="text-[17px] font-semibold">Per-transaction estimates</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Each row stores the factor that was applied, so the total can always be re-derived.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-y border-border bg-sunken text-left text-[12px] tracking-wide text-muted uppercase">
                <th scope="col" className="px-5 py-2.5 font-medium">Merchant</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Factor /100</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">CO2e</th>
              </tr>
            </thead>
            <tbody>
              {withCarbon.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3 font-medium">{row.merchant}</td>
                  <td className="px-3 py-3 text-muted">
                    {row.category.charAt(0).toUpperCase() + row.category.slice(1)}
                  </td>
                  <td className="fl-num px-3 py-3 text-right">
                    {formatMoney(row.amount, { sign: "never" })}
                  </td>
                  <td className="fl-num px-3 py-3 text-right text-muted">
                    {CARBON_FACTORS[row.category as keyof typeof CARBON_FACTORS]?.kgPer100Rupees ?? 0}
                  </td>
                  <td className="fl-num px-5 py-3 text-right font-semibold">
                    {(row.co2eKg ?? 0).toFixed(1)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4">
        <Link href="/sustainability" className="text-[14px] font-medium text-primary">
          Back to sustainability
        </Link>
      </div>
    </AppShell>
  );
}