import "server-only";
import { prisma } from "@/lib/db";
import {
  greenPointsFor,
  PAPERLESS_SHEETS_PER_BILL,
  PAPERLESS_SHEETS_PER_TRANSACTION,
} from "@/lib/carbon/factors";
import { log } from "@/lib/env";

/**
 * Sustainability metrics.
 *
 * Three separate things live here and it is worth being precise about each,
 * because they are easy to conflate and the difference matters to a user:
 *
 *   1. The carbon estimate — an inference from spending categories, labelled
 *      as an estimate everywhere it appears.
 *   2. The sustainability score — this platform's own 0-100 construct, defined
 *      below. Not a scientific measure and not comparable to any other one.
 *   3. The paperless count — a tally of sheets avoided, from stated constants.
 *
 * None of the three is presented as an audited figure.
 */

/** Carbon-emitting categories a user can choose between. */
const ZERO_CARBON_CATEGORIES = new Set([
  "SALARY",
  "TRANSFER",
  "SAVINGS",
  "LOAN",
  "GREEN_REWARD",
]);

export interface MonthlyCarbon {
  /** First day of the month, UTC. */
  month: Date;
  co2eKg: number;
  spend: number;
  transactionCount: number;
}

/**
 * Monthly carbon totals for a rolling window.
 *
 * A user with no transactions gets a row of zeroes rather than a gap, so the
 * trend chart shows a real zero instead of pretending the month does not
 * exist. Both offsets are recorded (a payment to a biller is a debit) because
 * the emissions come from what the money bought, not from the direction of the
 * ledger entry.
 */
export async function monthlyCarbon(
  userId: string,
  months = 12,
): Promise<MonthlyCarbon[]> {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: start },
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    select: { createdAt: true, amount: true, co2eKg: true },
  });

  const buckets = new Map<string, MonthlyCarbon>();

  for (let i = 0; i < months; i += 1) {
    const month = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    buckets.set(monthKey(month), {
      month,
      co2eKg: 0,
      spend: 0,
      transactionCount: 0,
    });
  }

  for (const txn of transactions) {
    const key = monthKey(txn.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.co2eKg += Number(txn.co2eKg);
    bucket.spend += Number(txn.amount);
    bucket.transactionCount += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.month.getTime() - b.month.getTime())
    .map((b) => ({ ...b, co2eKg: round2(b.co2eKg) }));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

export interface CategoryCarbon {
  category: string;
  co2eKg: number;
  spend: number;
  count: number;
}

/** Estimated carbon grouped by category, largest first. */
export async function carbonByCategory(
  userId: string,
  since?: Date,
): Promise<CategoryCarbon[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      fromUserId: userId,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: { category: true, co2eKg: true, amount: true },
  });

  const map = new Map<string, CategoryCarbon>();
  for (const txn of transactions) {
    const existing = map.get(txn.category) ?? {
      category: txn.category,
      co2eKg: 0,
      spend: 0,
      count: 0,
    };
    existing.co2eKg += Number(txn.co2eKg);
    existing.spend += Number(txn.amount);
    existing.count += 1;
    map.set(txn.category, existing);
  }

  return [...map.values()]
    .map((c) => ({ ...c, co2eKg: round2(c.co2eKg) }))
    .sort((a, b) => b.co2eKg - a.co2eKg);
}

/**
 * The sustainability score, 0-100.
 *
 * Two components, equally weighted:
 *
 *   green share (50%) the share of this month's *spending* that went to
 *                      lower-carbon categories, weighted by that category's
 *                      green points rather than counted as a binary in/out;
 *   points earned (50%) green points relative to a steady-use benchmark.
 *
 * The second term saturates at 400 points, which is roughly one month of
 * consistently paying bills online and topping up by public transport. Past
 * that, more points stop raising the score, so the metric rewards a habit
 * rather than a balance.
 *
 * This is a product construct. It is not an environmental rating, it is not
 * comparable to anyone else's, and it is not presented as either.
 */
export async function sustainabilityScore(userId: string): Promise<number> {
  const monthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  );

  const [transactions, user] = await Promise.all([
    prisma.transaction.findMany({
      where: { fromUserId: userId, createdAt: { gte: monthStart } },
      select: { category: true, amount: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { greenPoints: true },
    }),
  ]);

  const spendByCategory = new Map<string, number>();
  let totalSpend = 0;

  for (const txn of transactions) {
    if (ZERO_CARBON_CATEGORIES.has(txn.category)) continue;
    const amount = Number(txn.amount);
    spendByCategory.set(
      txn.category,
      (spendByCategory.get(txn.category) ?? 0) + amount,
    );
    totalSpend += amount;
  }

  // No spending this month: a neutral half rather than a zero. Being judged on
  // a month in which nothing was spent would be punishing inactivity.
  const greenShare =
    totalSpend === 0
      ? 0.5
      : [...spendByCategory.entries()].reduce((sum, [category, amount]) => {
          const share = amount / totalSpend;
          const points = greenPointsFor(category);
          return sum + share * Math.min(1, points / 30);
        }, 0);

  const pointsTerm = Math.min(1, (user?.greenPoints ?? 0) / 400);

  return Math.round((greenShare * 0.5 + pointsTerm * 0.5) * 100);
}

/**
 * Recomputes and stores the sustainability score on the user row.
 *
 * Called alongside `refreshTrustScore` after spending activity.
 */
export async function refreshSustainabilityScore(userId: string): Promise<void> {
  try {
    const score = await sustainabilityScore(userId);
    await prisma.user.update({
      where: { id: userId },
      data: { sustainability: score },
    });
  } catch (error) {
    log("error", "sustainability refresh failed", {
      userId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * How much paper the user has avoided.
 *
 * Derived from the stated per-event constants rather than stored, so the
 * number always matches the transactions it is based on and cannot drift.
 */
export async function paperlessImpact(userId: string) {
  const [transactions, billPayments] = await Promise.all([
    prisma.transaction.count({
      where: { fromUserId: userId, status: "COMPLETED" },
    }),
    prisma.transaction.count({
      where: {
        fromUserId: userId,
        status: "COMPLETED",
        category: { in: ["BILL_PAYMENT", "RECHARGE"] },
      },
    }),
  ]);

  const otherTransactions = Math.max(0, transactions - billPayments);
  const sheets =
    otherTransactions * PAPERLESS_SHEETS_PER_TRANSACTION +
    billPayments * PAPERLESS_SHEETS_PER_BILL;

  return { sheets, transactions, billPayments };
}

/**
 * Village leaderboard.
 *
 * Compares users against others in the same village, which keeps it
 * meaningful: a rural user should not be measured against a city user.
 *
 * Users with a zero score are excluded — a leaderboard that ranks people with no
 * activity is discouraging rather than motivating.
 */
export async function villageLeaderboard(userId: string, limit = 10) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { village: true, sustainability: true, trustScore: true },
  });

  if (!me) return { me: null, entries: [] as LeaderboardEntry[], total: 0 };

  const candidates = await prisma.user.findMany({
    where: { village: me.village, status: "ACTIVE", id: { not: userId } },
    select: { id: true, name: true, sustainability: true, greenPoints: true },
    orderBy: { sustainability: "desc" },
    take: limit * 2,
  });

  const everyone = [
    { id: userId, name: null as string | null, sustainability: me.sustainability, greenPoints: 0 },
    ...candidates.map((c) => ({
      id: c.id,
      name: c.name,
      sustainability: c.sustainability,
      greenPoints: c.greenPoints,
    })),
  ]
    .filter((entry) => entry.sustainability > 0)
    .sort((a, b) => b.sustainability - a.sustainability);

  const entries: LeaderboardEntry[] = everyone.map((entry, index) => ({
    rank: index + 1,
    isMe: entry.id === userId,
    name: entry.id === userId ? null : entry.name,
    sustainability: entry.sustainability,
    greenPoints: entry.greenPoints,
  }));

  return {
    me: entries.find((e) => e.isMe) ?? null,
    entries: entries.slice(0, limit),
    total: entries.length,
  };
}

export interface LeaderboardEntry {
  rank: number;
  isMe: boolean;
  /** Null for the current user: a rank table need not echo your own name. */
  name: string | null;
  sustainability: number;
  greenPoints: number;
}

export { greenPointsFor };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
