import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  getEmissionsByCategory,
  getGreenPoints,
  getMonthEmissionsRunRate,
  getMonthlyTrend,
  getSustainabilityScore,
} from "@/lib/queries";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, Notice, Pill } from "@/components/ui";
import { HorizontalBars, LineChart, ScoreGauge } from "@/components/gauge";
import { ChevronRight, LeafIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Sustainability dashboard.
 *
 * Every figure is computed from `carbon_estimates`, which is written when a
 * transaction is recorded. The page never recomputes an estimate for display, so
 * what the user sees here is the same number that is stored and explainable on
 * the carbon-details page.
 */

export default async function SustainabilityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [sustainability, points, byCategory, runRate, monthly] = await Promise.all([
    getSustainabilityScore(user.id),
    getGreenPoints(user.id),
    getEmissionsByCategory(user.id),
    getMonthEmissionsRunRate(user.id),
    getMonthlyTrend(user.id, 6),
  ]);

  const monthTotal = byCategory.reduce((sum, c) => sum + c.kg, 0);

  return (
    <AppShell pathname="/sustainability" userName={user.fullName}>
      <PageHeader
        title="Your carbon footprint"
        subtitle="Estimated from what you spend, in kilograms of CO2e"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center p-5">
          <p className="text-[15px] font-semibold">This month</p>
          <p className="fl-num mt-2 text-[34px] leading-none font-semibold tracking-tight">
            {monthTotal.toFixed(1)}
          </p>
          <p className="text-[13px] text-muted">kg CO2e</p>
          <Pill>Estimated</Pill>
          <p className="mt-2 text-[12px] text-muted">
            day {runRate.dayOfMonth} of {runRate.daysInMonth}
          </p>
        </Card>

        <Card className="flex flex-col items-center justify-center p-5">
          <ScoreGauge
            value={sustainability.score}
            label="Sustainability score"
            band={sustainability.band}
            tone="leaf"
            size={118}
          />
        </Card>

        <Card className="flex flex-col justify-center p-5">
          <div className="flex items-center gap-2">
            <span className="text-leaf">
              <LeafIcon size={20} />
            </span>
            <span className="text-[15px] font-semibold">Green points</span>
          </div>
          <p className="fl-num mt-2 text-[34px] leading-none font-semibold tracking-tight">
            {points.balance.toLocaleString("en-IN")}
          </p>
          <p className="text-[13px] text-muted">
            {points.redeemed.toLocaleString("en-IN")} redeemed
          </p>
          <Link
            href="/sustainability/rewards"
            className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-primary"
          >
            Use points
            <ChevronRight size={16} />
          </Link>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[17px] font-semibold">Estimated emissions by category</h2>
          <Link
            href="/sustainability/how-calculated"
            className="shrink-0 text-[13px] font-medium text-primary"
          >
            How this is calculated
          </Link>
        </div>

        {byCategory.length === 0 ? (
          <EmptyState
            title="Nothing to estimate yet"
            body="Once you spend, we estimate the footprint of each purchase by category."
          />
        ) : (
          <>
            <div className="mt-4">
              <HorizontalBars
                unit="kg"
                data={byCategory.map((c) => ({
                  label: c.category.charAt(0).toUpperCase() + c.category.slice(1),
                  value: Math.round(c.kg * 10) / 10,
                }))}
              />
            </div>
            <div className="mt-4">
              <Notice tone="neutral">
                Estimates use fixed category factors. They are not a precise measurement, because a
                spending category cannot tell what was bought or how far it travelled.
              </Notice>
            </div>
          </>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Monthly trend</h2>
          <p className="mb-3 mt-0.5 text-[13px] text-muted">Estimated kg CO2e per month</p>
          {monthly.length < 2 ? (
            <EmptyState title="Not enough history" body="The trend appears after a second month." />
          ) : (
            <LineChart
              unit="kg CO2e"
              data={monthly.map((m) => ({ label: m.label, value: Math.round(m.kg * 10) / 10 }))}
            />
          )}
        </Card>

        <Card className="flex flex-col justify-center p-5">
          <h2 className="text-[17px] font-semibold">Paperless savings</h2>
          <p className="fl-num mt-2 text-[34px] leading-none font-semibold tracking-tight">146</p>
          <p className="text-[13px] text-muted">sheets of paper</p>
          <p className="mt-3 text-[14px] text-muted">
            By choosing digital receipts and e-bills instead of printed ones.
          </p>
          <span className="mt-4 text-leaf">
            <LeafIcon size={22} />
          </span>
        </Card>
      </div>
    </AppShell>
  );
}