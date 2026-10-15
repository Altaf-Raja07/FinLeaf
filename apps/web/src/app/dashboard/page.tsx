import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  HandCoins,
  Leaf,
  PiggyBank,
  Shield,
} from "lucide-react";
import { Alert, Card, CardHeader, EmptyState, PageHeader, Pill, ProgressBar, Stat } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/auth/guard";
import { formatDateTime, formatMoney, formatCo2e } from "@/lib/i18n";
import { monthlyCarbon, paperlessImpact, sustainabilityScore } from "@/lib/sustainability";
import { loanEligibility } from "@/lib/trust";
import { CarbonTrend } from "./CarbonTrend";

/**
 * The dashboard.
 *
 * Everything on this screen is computed from the signed-in user's own records.
 * A user with no activity sees real zeroes and an honest empty state — there is
 * no sample data, no seeded chart and no illustrative balance anywhere in this
 * page, which is the change from the prototype stage that makes the numbers
 * mean anything.
 */

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const account = await requireAccount(user.id);

  const [
    recentTxns,
    carbon,
    paperless,
    sustainability,
    unresolvedFlags,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
      },
    }),
    monthlyCarbon(user.id, 6),
    paperlessImpact(user.id),
    sustainabilityScore(user.id),
    prisma.anomalyFlag.count({ where: { userId: user.id, resolved: false } }),
  ]);

  const thisMonth = carbon[carbon.length - 1];
  const lastMonth = carbon[carbon.length - 2];
  const delta = carbonDelta(lastMonth?.co2eKg ?? 0, thisMonth?.co2eKg ?? 0);
  const eligibility = loanEligibility(user.trustScore);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={user.village}
        title={t("dashboard.greeting", { name: user.name })}
        subtitle={t("dashboard.subtitle")}
      />

      {unresolvedFlags > 0 ? (
        <Alert
          tone="warning"
          title={t("transfer.wasThisYou")}
          icon={<Shield className="h-4 w-4" />}
        >
          {t("transfer.flagBody", { count: unresolvedFlags })}{" "}
          <Link href="/dashboard/history?flagged=true" className="font-bold underline">
            {t("action.seeDetails")}
          </Link>
        </Alert>
      ) : null}

      {/* Balance and the two headline scores. */}
      <section aria-label={t("dashboard.balance")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("dashboard.balance")}
          value={formatMoney(account.balance.toString())}
          hint={`${t("dashboard.accountNumber")} ${account.number}`}
          icon={<PiggyBank className="h-4 w-4" />}
          className="sm:col-span-2"
        />

        <Stat
          label={t("dashboard.trustScore")}
          value={user.trustScore}
          hint={t("dashboard.scoreExplain")}
          icon={<Shield className="h-4 w-4" />}
        />

        <Stat
          label={t("dashboard.sustainability")}
          value={sustainability}
          hint={t("carbon.scoreHelp")}
          icon={<Leaf className="h-4 w-4" />}
        />
      </section>

      {/* Quick actions — the four things a user opens the app to do. */}
      <section aria-label={t("dashboard.quickActions")}>
        <h2 className="sr-only">{t("dashboard.quickActions")}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { href: "/dashboard/transfer", label: t("transfer.title"), icon: ArrowLeftRight },
              { href: "/dashboard/bills", label: t("bills.title"), icon: HandCoins },
              { href: "/dashboard/savings", label: t("savings.title"), icon: PiggyBank },
              { href: "/dashboard/loans", label: t("loans.title"), icon: Shield },
            ] satisfies Array<{ href: Route; label: string; icon: typeof ArrowLeftRight }>
          ).map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                className="card flex flex-col items-start gap-2 no-underline transition-colors hover:bg-leaf-50"
              >
                <action.icon className="h-6 w-6 text-leaf-700" aria-hidden="true" />
                <span className="font-bold">{action.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Carbon trend. */}
        <section className="lg:col-span-3" aria-labelledby="carbon-heading">
          <Card>
            <CardHeader
              title={
                <span id="carbon-heading">
                  {t("carbon.title")} — {t("carbon.trend")}
                </span>
              }
              subtitle={t("carbon.trendHelp")}
              action={
                <Pill status="neutral">{t("carbon.estimate")}</Pill>
              }
            />
            <Suspense fallback={<div className="h-56" aria-hidden="true" />}>
              <CarbonTrend data={carbon} locale={locale} />
            </Suspense>
            <p className="field-help mt-3">
              {t("dashboard.carbonThisMonth")}:{" "}
              <strong className="text-ink">{formatCo2e(thisMonth?.co2eKg ?? 0, locale)}</strong>{" "}
              {delta ? (
                <span className={delta.direction === "down" ? "text-leaf-700" : "text-ink-soft"}>
                  {" "}
                  ({t("dashboard.changeFromLastMonth", {
                    direction: t(delta.direction === "down" ? "dashboard.down" : "dashboard.up"),
                    percent: delta.percent,
                  })})
                </span>
              ) : (
                <span className="text-ink-soft"> ({t("dashboard.noChange")})</span>
              )}
            </p>
          </Card>
        </section>

        {/* Rewards and credit. */}
        <section className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title={t("rewards.points")} />
            <p className="text-3xl font-bold tracking-tight tnum text-leaf-800">
              {user.greenPoints}
            </p>
            <p className="field-help mt-1">{t("carbon.pointsAvailable", { points: user.greenPoints })}</p>
            <div className="mt-3">
              <ProgressBar
                value={user.greenPoints}
                max={400}
                label={t("rewards.pointsEarned")}
              />
            </div>
            <Link
              href="/dashboard/rewards"
              className="btn btn-secondary mt-4 w-full no-underline"
            >
              {t("rewards.title")}
            </Link>
          </Card>

          <Card>
            <CardHeader title={t("dashboard.paperless")} />
            <p className="text-2xl font-bold tracking-tight tnum">
              {paperless.sheets.toLocaleString("en-IN")}
            </p>
            <p className="field-help mt-1">{t("carbon.paperlessHelp")}</p>
          </Card>

          {eligibility.eligible ? (
            <Alert tone="success" title={t("loans.eligibleFor", { amount: formatMoney(eligibility.maxAmount) })}>
              <Link href="/dashboard/loans" className="font-bold underline">
                {t("loans.apply", { amount: formatMoney(eligibility.maxAmount) })}
              </Link>
            </Alert>
          ) : (
            <Alert tone="info" title={t("loans.eligibilityBelow")} />
          )}
        </section>
      </div>

      {/* Recent activity. */}
      <section aria-labelledby="activity-heading">
        <Card>
          <CardHeader
            title={<span id="activity-heading">{t("dashboard.recentActivity")}</span>}
            action={
              <Link href="/dashboard/history" className="btn btn-ghost">
                {t("action.viewAll")}
              </Link>
            }
          />

          {recentTxns.length === 0 ? (
            <EmptyState
              title={t("dashboard.recentEmpty")}
              body={t("transfer.subtitle")}
              action={
                <Link href="/dashboard/transfer" className="btn btn-primary">
                  {t("transfer.title")}
                </Link>
              }
              icon={<ArrowLeftRight className="h-8 w-8" />}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-rule">
              {recentTxns.map((txn) => {
                const isOut = txn.fromUserId === user.id;
                const counterparty = isOut ? txn.toUser?.name : txn.fromUser?.name;
                return (
                  <li key={txn.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isOut ? "bg-surface-sunken text-ink-soft" : "bg-leaf-50 text-leaf-700"
                      }`}
                      aria-hidden="true"
                    >
                      {isOut ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {isOut ? t("history.debit") : t("history.credit")}
                        {counterparty ? ` · ${counterparty}` : ""}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {formatDateTime(txn.createdAt, locale)} · {txn.category}
                      </p>
                    </div>

                    <p
                      className={`shrink-0 text-sm font-bold tnum ${
                        isOut ? "text-ink" : "text-leaf-700"
                      }`}
                    >
                      {isOut ? "−" : "+"}
                      {formatMoney(txn.amount.toString())}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

/** Month-on-month change, with a guard against dividing by zero. */
function carbonDelta(previous: number, current: number) {
  if (previous === 0) {
    return current === 0 ? null : { percent: 100, direction: "up" as const };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return null;
  return {
    percent: Math.abs(percent),
    direction: percent < 0 ? ("down" as const) : ("up" as const),
  };
}
