import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  getDashboardData,
  type MonthlyEmission,
  type TransactionRow,
} from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BarChart, ScoreGauge } from "@/components/gauge";
import { Card, EmptyState, ErrorState, IconTile, Pill, Skeleton } from "@/components/ui";
import {
  BillIcon,
  CategoryIcon,
  CheckIcon,
  ChevronRight,
  LeafIcon,
  PiggyIcon,
  PhoneIcon,
  SendIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let failure: string | null = null;

  try {
    data = await getDashboardData(user.id);
  } catch (err) {
    console.error("[dashboard] load failed", err);
    failure = "We could not reach the database. Check that it is running, then try again.";
  }

  return (
    <AppShell pathname="/dashboard" userName={user.fullName} alerts={data?.openAlerts ?? 0}>
      <PageHeader
        title={greeting(user.fullName)}
        subtitle={today()}
        alerts={data?.openAlerts ?? 0}
      />

      {!data ? (
        <ErrorState body={failure ?? "Something went wrong."} />
      ) : data.recent.length === 0 && data.monthly.length === 0 ? (
        <Card>
          <EmptyState
            title="No activity yet"
            body="Once you receive money or pay a bill, your balance and transactions will appear here."
            action={
              <Link
                href="/bills"
                className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-semibold text-white hover:bg-primary-hover"
              >
                Make your first payment
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* --- Balance and scores ------------------------------------- */}
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr]">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">Total balance</span>
                <Pill tone="neutral">Estimated</Pill>
                <ChevronRight size={18} className="ml-auto text-muted" />
              </div>
              <p className="fl-num mt-3 text-[34px] leading-none font-semibold tracking-tight md:text-[40px]">
                {formatMoney(data.totalBalance, { sign: "never" })}
              </p>
              <p className="mt-3 text-[14px] text-muted">
                across {data.accountCount} {data.accountCount === 1 ? "account" : "accounts"}
              </p>
            </Card>

            <Card className="flex items-center justify-center p-5">
              {data.trustScore ? (
                <ScoreGauge
                  value={data.trustScore.score}
                  label="Trust score"
                  band={data.trustScore.band}
                  tone="trust"
                />
              ) : (
                <TrustScorePending />
              )}
            </Card>

            <Card className="flex flex-col items-center justify-center gap-1 p-5">
              <ScoreGauge
                value={data.sustainability.score}
                label="Sustainability score"
                tone="leaf"
              />
              <p className="mt-1 text-center text-[13px] text-muted">
                This month{" "}
                <span className="fl-num font-medium text-foreground">{data.monthEmissions} kg CO2e</span>
              </p>
              {/* Say so when the month is partial, otherwise a five-day total
                  reads as a collapse compared with a complete month. */}
              {data.monthComplete ? null : (
                <p className="text-center text-[12px] text-muted">
                  day {data.dayOfMonth} of {data.daysInMonth}
                </p>
              )}
            </Card>
          </div>

          {/* --- Quick actions ------------------------------------------- */}
          <Card className="mt-4 p-5">
            <h2 className="mb-3 text-[17px] leading-6 font-semibold">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QuickAction href="/transfer" icon={<SendIcon size={20} />} label="Send money" />
              <QuickAction href="/bills" icon={<BillIcon size={20} />} label="Pay a bill" />
              <QuickAction href="/goals" icon={<PiggyIcon size={20} />} label="Add savings" />
              <QuickAction href="/bills?category=recharge" icon={<PhoneIcon size={20} />} label="Recharge" />
            </div>
          </Card>

          {/* --- Activity and chart -------------------------------------- */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[17px] leading-6 font-semibold">Recent transactions</h2>
                <Link href="/transactions" className="flex items-center gap-0.5 text-[14px] font-medium text-primary">
                  See all
                  <ChevronRight size={16} />
                </Link>
              </div>
              {data.recent.length === 0 ? (
                <EmptyState
                  title="Nothing here yet"
                  body="Your most recent payments and transfers will show up here."
                />
              ) : (
                <ul className="flex flex-col">
                  {data.recent.map((row) => (
                    <TransactionListItem key={row.id} row={row} />
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex flex-col p-5">
              <h2 className="text-[17px] leading-6 font-semibold">This month</h2>
              <p className="mt-0.5 mb-3 text-[13px] text-muted">Estimated kg CO2e</p>

              {data.monthly.length === 0 ? (
                <EmptyState title="No emissions data yet" body="Once you spend, we estimate the footprint of each purchase." />
              ) : (
                <>
                  <BarChart
                    unit="kg CO2e"
                    data={data.monthly.map((point: MonthlyEmission, index: number) => ({
                      label: point.label,
                      value: point.kg,
                      // Highlight the most recent month, which is what the user
                      // came to read.
                      highlight: index === data.monthly.length - 1,
                    }))}
                  />
                  <MonthDelta monthly={data.monthly} />
                </>
              )}
            </Card>
          </div>

          {/* --- Green points strip -------------------------------------- */}
          <Card className="mt-4 flex items-center gap-3 px-5 py-4">
            <span className="text-leaf">
              <LeafIcon size={22} />
            </span>
            <p className="flex-1 text-[14px]">
              You have{" "}
              <span className="fl-num font-semibold">{data.greenPoints.balance.toLocaleString("en-IN")}</span>{" "}
              green points
              {data.greenPoints.redeemed > 0 && (
                <span className="text-muted"> ({data.greenPoints.redeemed.toLocaleString("en-IN")} redeemed)</span>
              )}
            </p>
            <Link href="/sustainability/rewards" className="text-[14px] font-medium text-primary">
              Use points
            </Link>
          </Card>
        </>
      )}
    </AppShell>
  );
}

/* --- pieces -------------------------------------------------------------- */

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-md border border-border px-3 py-4 text-center transition-colors hover:bg-sunken"
    >
      <span className="text-primary">{icon}</span>
      <span className="text-[14px] font-semibold">{label}</span>
    </Link>
  );
}

const CATEGORY_TONE: Record<string, "primary" | "leaf" | "trust" | "amber" | "neutral"> = {
  fuel: "amber",
  travel: "trust",
  groceries: "leaf",
  dining: "primary",
  electronics: "primary",
  bills: "trust",
  recharge: "neutral",
  health: "leaf",
  transfer: "neutral",
};

function TransactionListItem({ row }: { row: TransactionRow }) {
  const credit = row.direction === "credit";
  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <IconTile tone={CATEGORY_TONE[row.category] ?? "neutral"}>
        <CategoryIcon category={row.category} size={18} />
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{row.merchant}</span>
        <span className="block truncate text-[13px] text-muted">
          {titleCase(row.category)} · {relativeDate(row.createdAt)}
        </span>
      </span>
      <span
        className={`fl-num shrink-0 text-[14.5px] font-semibold ${credit ? "text-leaf" : ""}`}
      >
        {credit ? "+" : "−"}
        {formatMoney(row.amount, { sign: "never" }).replace("₹", "₹")}
      </span>
    </li>
  );
}

/**
 * Month-over-month change, compared like for like.
 *
 * The current month is usually only partly elapsed, so comparing its total with a
 * complete month would report a huge fall (or rise) that reflects the calendar
 * rather than behaviour. This compares the same day range in both months, and
 * says so when the month is still in progress.
 *
 * Sign and wording are paired so meaning never depends on colour alone.
 */
function MonthDelta({ monthly }: { monthly: MonthlyEmission[] }) {
  if (monthly.length < 2) return null;
  const previousFull = monthly[monthly.length - 2].kg;
  const currentPartial = monthly[monthly.length - 1].kg;
  if (previousFull === 0) return null;

  // Only trust the comparison once the month is mostly elapsed, otherwise a
  // five-day total can swing wildly on a single purchase.
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const elapsedFraction = dayOfMonth / daysInMonth;
  const monthComplete = elapsedFraction > 0.9;

  const currentForCompare = monthComplete
    ? currentPartial
    : (currentPartial / elapsedFraction);
  const changePct = Math.round(((currentForCompare - previousFull) / previousFull) * 100);

  if (changePct === 0) return null;

  const down = changePct < 0;
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md bg-leaf-soft px-3 py-2.5">
      <span className="text-leaf">
        <LeafIcon size={17} />
      </span>
      <p className="text-[13.5px] text-leaf">
        <span className="font-semibold">
          {down ? "Down" : "Up"} {Math.abs(changePct)}%
        </span>{" "}
        versus last month
        {!monthComplete && (
          <span className="text-leaf">
            {" "}
            <span className="opacity-80">
              (day {dayOfMonth} of {daysInMonth}, rate-adjusted)
            </span>
          </span>
        )}
      </p>
      <span className="ml-auto text-leaf">
        <CheckIcon size={15} />
      </span>
    </div>
  );
}

/** Shown when no trust score has been computed yet, with the fix offered. */
function TrustScorePending() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Skeleton className="h-24 w-24 rounded-full" />
      <span className="text-[13px] font-medium">Trust score</span>
      <Link href="/trust-score" className="text-[13px] font-medium text-primary">
        Calculate now
      </Link>
    </div>
  );
}

/* --- formatting ---------------------------------------------------------- */

function greeting(name: string): string {
  const first = name.split(" ")[0];
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${first}`;
}

function today(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function relativeDate(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}