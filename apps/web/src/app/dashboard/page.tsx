import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Gift,
  HandCoins,
  Leaf,
  MapPin,
  MessageCircleQuestion,
  PiggyBank,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Alert, Card, CardHeader, EmptyState, Pill, ProgressBar } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/auth/guard";
import { formatDateTime, formatMoney, formatCo2e, formatNumber } from "@/lib/i18n";
import { monthlyCarbon, paperlessImpact, sustainabilityScore } from "@/lib/sustainability";
import { loanEligibility } from "@/lib/trust";
import { CarbonTrend } from "./CarbonTrend";

/**
 * The FinLeaf dashboard.
 *
 * Modern, accessible rural banking overview. All figures are live computations
 * derived from the authenticated user's records.
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

  // Masked account number for display: e.g. "•••• 4821"
  const maskedAccNum = account.number.length > 4
    ? `•••• ${account.number.slice(-4)}`
    : account.number;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Welcome & Context Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {t("dashboard.greeting", { name: user.name })}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-semibold text-leaf-800">
              <CheckCircle2 className="h-3 w-3 text-leaf-700" />
              Active
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPin className="h-3.5 w-3.5 text-leaf-700 shrink-0" />
            <span>{user.village || "Rural Branch"}</span>
            <span className="text-ink-faint">·</span>
            <span>{t("dashboard.subtitle")}</span>
          </p>
        </div>

        <Link
          href="/dashboard/assistant"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-leaf-200 bg-leaf-50/80 px-3.5 py-2 text-xs font-semibold text-leaf-900 shadow-xs hover:bg-leaf-100 transition-colors sm:self-auto no-underline"
        >
          <Sparkles className="h-3.5 w-3.5 text-leaf-700 animate-pulse" />
          <span>Ask Voice Assistant</span>
        </Link>
      </div>

      {/* Flagged Anomaly Alert if any */}
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

      {/* Hero Account Showcase Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-leaf-950 via-emerald-950 to-leaf-900 p-6 sm:p-8 text-white shadow-xl shadow-leaf-950/20 border border-leaf-700/30">
        {/* Ambient glow backgrounds */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-leaf-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Card Top: Type & Account Num */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 backdrop-blur-md">
                <Leaf className="h-4 w-4 text-emerald-300" />
              </div>
              <span className="text-xs font-semibold tracking-wide text-emerald-200/90 uppercase">
                FinLeaf Digital Savings
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-mono font-medium text-emerald-100/80 backdrop-blur-md">
                {maskedAccNum}
              </span>
            </div>
          </div>

          {/* Balance */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-200/70">
              {t("dashboard.balance")}
            </p>
            <p className="mt-1 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white tnum">
              {formatMoney(account.balance.toString())}
            </p>
          </div>

          {/* Quick Action Tiles embedded on card */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-2 border-t border-white/10">
            {(
              [
                { href: "/dashboard/transfer", label: t("transfer.title"), icon: ArrowLeftRight },
                { href: "/dashboard/bills", label: t("bills.title"), icon: HandCoins },
                { href: "/dashboard/savings", label: t("savings.title"), icon: PiggyBank },
                { href: "/dashboard/assistant", label: "Voice Assistant", icon: MessageCircleQuestion },
              ] satisfies Array<{ href: Route; label: string; icon: typeof ArrowLeftRight }>
            ).map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-2.5 rounded-2xl bg-white/10 p-3 backdrop-blur-md no-underline transition-[background-color,transform] duration-150 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white group-hover:bg-emerald-400 group-hover:text-emerald-950 transition-colors">
                  <action.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-white truncate">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Health & Eco KPI Cards */}
      <section aria-label="Key Indicators" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Trust Score */}
        <div className="rounded-2xl border border-rule bg-surface p-4 shadow-xs hover:border-leaf-300 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              {t("dashboard.trustScore")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-ink tnum">
              {user.trustScore}
            </span>
            <span className="text-xs text-ink-faint">/ 850</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft truncate">
            {eligibility.eligible ? "Pre-approved for credit" : t("dashboard.scoreExplain")}
          </p>
        </div>

        {/* Sustainability Score */}
        <div className="rounded-2xl border border-rule bg-surface p-4 shadow-xs hover:border-leaf-300 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              {t("dashboard.sustainability")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Leaf className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-ink tnum">
              {sustainability}
            </span>
            <span className="text-xs text-ink-faint">/ 100</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft truncate">
            {sustainability >= 70 ? "Excellent Eco Rank" : t("carbon.scoreHelp")}
          </p>
        </div>

        {/* Green Points */}
        <div className="rounded-2xl border border-rule bg-surface p-4 shadow-xs hover:border-leaf-300 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              {t("rewards.points")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Gift className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-ink tnum">
              {user.greenPoints}
            </span>
            <span className="text-xs text-ink-faint">pts</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft truncate">
            {t("carbon.pointsAvailable", { points: user.greenPoints })}
          </p>
        </div>

        {/* Paperless Impact */}
        <div className="rounded-2xl border border-rule bg-surface p-4 shadow-xs hover:border-leaf-300 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              {t("dashboard.paperless")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-ink tnum">
              {formatNumber(paperless.sheets, locale)}
            </span>
            <span className="text-xs text-ink-faint">sheets</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft truncate">
            {t("carbon.paperlessHelp")}
          </p>
        </div>
      </section>

      {/* Pre-Approved Micro-Loan Banner if Eligible */}
      {eligibility.eligible && (
        <div className="relative overflow-hidden rounded-2xl border border-leaf-300 bg-gradient-to-r from-leaf-50 via-emerald-50 to-leaf-50 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-600 text-white shadow-xs">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-leaf-950">
                  {t("loans.eligibleFor", { amount: formatMoney(eligibility.maxAmount) })}
                </p>
                <p className="text-xs text-leaf-800/80 mt-0.5">
                  Instant community-backed approval based on your {user.trustScore} Trust Score. Zero collateral required.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/loans"
              className="btn btn-primary shrink-0 self-start sm:self-auto no-underline text-xs"
            >
              {t("loans.apply", { amount: formatMoney(eligibility.maxAmount) })}
            </Link>
          </div>
        </div>
      )}

      {/* Main Grid: Charts, Rewards, & History */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column (3 cols): Carbon Footprint & Activity */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          {/* Carbon Footprint Trend */}
          <section aria-labelledby="carbon-heading">
            <Card>
              <CardHeader
                title={
                  <span id="carbon-heading" className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-leaf-700" />
                    <span>{t("carbon.title")} — {t("carbon.trend")}</span>
                  </span>
                }
                subtitle={t("carbon.trendHelp")}
                action={<Pill status="neutral">{t("carbon.estimate")}</Pill>}
              />

              <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-surface-sunken" aria-hidden="true" />}>
                <CarbonTrend data={carbon} locale={locale} />
              </Suspense>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-sunken p-3 text-xs">
                <span className="text-ink-soft">
                  {t("dashboard.carbonThisMonth")}:{" "}
                  <strong className="text-ink">{formatCo2e(thisMonth?.co2eKg ?? 0, locale)}</strong>
                </span>
                {delta ? (
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      delta.direction === "down" ? "text-leaf-700" : "text-amber-700"
                    }`}
                  >
                    {delta.direction === "down" ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5" />
                    )}
                    {t("dashboard.changeFromLastMonth", {
                      direction: t(delta.direction === "down" ? "dashboard.down" : "dashboard.up"),
                      percent: delta.percent,
                    })}
                  </span>
                ) : (
                  <span className="text-ink-faint">{t("dashboard.noChange")}</span>
                )}
              </div>
            </Card>
          </section>

          {/* Recent Activity */}
          <section aria-labelledby="activity-heading">
            <Card>
              <CardHeader
                title={
                  <span id="activity-heading" className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-leaf-700" />
                    <span>{t("dashboard.recentActivity")}</span>
                  </span>
                }
                action={
                  <Link href="/dashboard/history" className="btn btn-ghost text-xs">
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
                      <li key={txn.id} className="flex items-center gap-3.5 py-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                            isOut ? "bg-surface-sunken text-ink-soft" : "bg-leaf-100 text-leaf-800"
                          }`}
                          aria-hidden="true"
                        >
                          {isOut ? (
                            <ArrowUpRight className="h-4 w-4 text-ink-soft" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4 text-leaf-700" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {isOut ? t("history.debit") : t("history.credit")}
                            {counterparty ? ` · ${counterparty}` : ""}
                          </p>
                          <p className="truncate text-xs text-ink-faint">
                            {formatDateTime(txn.createdAt, locale)} · {txn.category}
                          </p>
                        </div>

                        <p
                          className={`shrink-0 text-sm font-black tnum ${
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

        {/* Right Column (2 cols): Rewards, Community Circles, & Voice */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Rewards Card */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-leaf-700" />
                  <span>{t("rewards.title")}</span>
                </span>
              }
            />
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-extrabold tracking-tight tnum text-leaf-800">
                  {user.greenPoints}
                </p>
                <p className="field-help mt-0.5">{t("carbon.pointsAvailable", { points: user.greenPoints })}</p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-leaf-50 px-2.5 py-1 text-xs font-semibold text-leaf-800 border border-leaf-200">
                  Target: 400 pts
                </span>
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar
                value={user.greenPoints}
                max={400}
                label={t("rewards.pointsEarned")}
              />
            </div>

            <Link
              href="/dashboard/rewards"
              className="btn btn-secondary mt-5 w-full no-underline text-xs"
            >
              Redeem Rewards & Trees
            </Link>
          </Card>

          {/* Trust Circles Card */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-leaf-700" />
                  <span>Trust Circles</span>
                </span>
              }
            />
            <p className="text-xs text-ink-soft leading-relaxed">
              Form or join a village peer savings circle. Vouch for neighbors, build credit reputation collectively, and qualify for larger micro-loans.
            </p>
            <Link
              href="/dashboard/circles"
              className="btn btn-ghost mt-4 w-full border border-rule no-underline text-xs text-ink font-semibold"
            >
              Explore Community Circles
            </Link>
          </Card>

          {/* Multilingual Voice Assistant Promo */}
          <div className="rounded-2xl border border-leaf-200 bg-gradient-to-br from-leaf-50 to-emerald-100/50 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-700 text-white shadow-xs">
                <MessageCircleQuestion className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-leaf-950 uppercase tracking-wider">Voice Banking</p>
                <p className="text-sm font-bold text-leaf-950 mt-0.5">Need help in your language?</p>
                <p className="text-xs text-leaf-800/80 mt-1">
                  Speak in Hindi, Kannada, or English. FinLeaf answers questions, checks balances, and explains schemes.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/assistant"
              className="btn btn-primary mt-4 w-full no-underline text-xs"
            >
              Open Voice Assistant
            </Link>
          </div>
        </div>
      </div>
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
