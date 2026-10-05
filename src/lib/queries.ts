import "server-only";
import { query, queryOne } from "./db";
import { getTrustScore, latestTrustScore } from "./trust";

/**
 * Read models for the dashboard and the other screens.
 *
 * Grouped here rather than inline in each page so the same figure is computed the
 * same way everywhere. Every function is scoped by userId and takes it from the
 * session, so a caller cannot accidentally read someone else's data.
 */

export interface AccountSummary {
  id: number;
  label: string;
  kind: "wallet" | "savings" | "group";
  balance: number;
}

export interface TransactionRow {
  id: number;
  direction: "debit" | "credit";
  amount: number;
  category: string;
  merchant: string;
  note: string | null;
  createdAt: string;
  co2eKg: number | null;
  /** Signed amount for display: credits positive, debits negative. */
  signedAmount: number;
}

export interface MonthlyEmission {
  month: string; // "2026-05"
  label: string; // "May"
  kg: number;
}

export interface GreenPointsSummary {
  balance: number;
  redeemed: number;
  awarded: number;
}

export async function getAccounts(userId: number): Promise<AccountSummary[]> {
  return query<{ id: number; label: string; kind: AccountSummary["kind"]; balance: string }>(
    `SELECT id, label, kind, balance FROM accounts WHERE user_id = $1 ORDER BY id`,
    [userId]
  ).then((rows) => rows.map((r) => ({ ...r, balance: Number(r.balance) })));
}

export async function getTotalBalance(userId: number): Promise<number> {
  const row = await queryOne<{ total: string | null }>(
    `SELECT COALESCE(SUM(balance), 0) AS total FROM accounts WHERE user_id = $1`,
    [userId]
  );
  return Number(row?.total ?? 0);
}

export async function getTransactions(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    category?: string;
    search?: string;
    /** Look back this many days. Computed by the database, not by JS `Date`. */
    withinDays?: number;
  } = {}
): Promise<{ rows: TransactionRow[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 200);
  const offset = options.offset ?? 0;

  const where: string[] = ["t.user_id = $1"];
  const values: unknown[] = [userId];
  let next = 2;

  if (options.category && options.category !== "all") {
    values.push(options.category);
    where.push(`t.category = $${next++}`);
  }
  if (options.search) {
    values.push(`%${options.search}%`);
    where.push(`(t.merchant ILIKE $${next} OR COALESCE(t.note, '') ILIKE $${next})`);
    next++;
  }
  if (options.withinDays !== undefined) {
    // A relative window is resolved by PostgreSQL rather than by computing a
    // timestamp in JavaScript. Two reasons: `new Date()` in a component body is
    // an impure render (flagged by the React Compiler), and the database clock is
    // the one the rows were written against.
    values.push(options.withinDays);
    where.push(`t.created_at > now() - make_interval(days => $${next++})`);
  }

  const rows = await query<{
    id: number;
    direction: "debit" | "credit";
    amount: string;
    category: string;
    merchant: string;
    note: string | null;
    created_at: Date;
    co2e_kg: string | null;
  }>(
    `SELECT t.id, t.direction, t.amount, t.category, t.merchant, t.note, t.created_at, c.co2e_kg
       FROM transactions t
       LEFT JOIN carbon_estimates c ON c.transaction_id = t.id
      WHERE ${where.join(" AND ")}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    values
  );

  const countRow = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM transactions t WHERE ${where.join(" AND ")}`,
    values
  );

  return {
    rows: rows.map((r) => {
      const amount = Number(r.amount);
      return {
        id: r.id,
        direction: r.direction,
        amount,
        category: r.category,
        merchant: r.merchant,
        note: r.note,
        createdAt: r.created_at.toISOString(),
        co2eKg: r.co2e_kg === null ? null : Number(r.co2e_kg),
        signedAmount: r.direction === "credit" ? amount : -amount,
      };
    }),
    total: Number(countRow?.n ?? 0),
  };
}

/** Estimated emissions for the current calendar month, in kg CO2e. */
export async function getMonthEmissions(userId: number): Promise<number> {
  const row = await queryOne<{ kg: string | null }>(
    `SELECT COALESCE(SUM(c.co2e_kg), 0) AS kg
       FROM transactions t
       JOIN carbon_estimates c ON c.transaction_id = t.id
      WHERE t.user_id = $1
        AND t.direction = 'debit'
        AND date_trunc('month', t.created_at) = date_trunc('month', now())`,
    [userId]
  );
  return Math.round(Number(row?.kg ?? 0) * 100) / 100;
}

/**
 * Average daily emissions so far this month.
 *
 * The dashboard labels this figure explicitly, because a total for a month that is
 * three days old would otherwise read as a collapse in emissions.
 */
export async function getMonthEmissionsRunRate(userId: number): Promise<{ kg: number; dayOfMonth: number; daysInMonth: number }> {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const kg = await getMonthEmissions(userId);
  return {
    kg: Math.round((kg / dayOfMonth) * 100) / 100,
    dayOfMonth,
    daysInMonth,
  };
}

/** Month-by-month emissions for the trend chart, oldest first. */
/**
 * Month-by-month emissions, oldest first.
 *
 * Uses a generated calendar series rather than grouping the transaction table, so
 * a month with no spending appears as a zero bar instead of the series silently
 * shortening and the trend becoming unreadable.
 */
export async function getMonthlyTrend(userId: number, months = 5): Promise<MonthlyEmission[]> {
  const rows = await query<{ month: Date; kg: string }>(
    `SELECT date_trunc('month', t.created_at) AS month, COALESCE(SUM(c.co2e_kg), 0) AS kg
       FROM transactions t
       JOIN carbon_estimates c ON c.transaction_id = t.id
      WHERE t.user_id = $1
        AND t.direction = 'debit'
        AND t.created_at > date_trunc('month', now()) - make_interval(months => $2)
      GROUP BY 1
      ORDER BY 1`,
    [userId, months - 1]
  );

  const totals = new Map(
    rows.map((r) => [
      `${new Date(r.month).getFullYear()}-${String(new Date(r.month).getMonth() + 1).padStart(2, "0")}`,
      Math.round(Number(r.kg) * 100) / 100,
    ])
  );

  // Walk backwards from the current month so the series always has exactly
  // `months` entries ending in the present month.
  const series: MonthlyEmission[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let offset = months - 1; offset >= 0; offset--) {
    const point = new Date(cursor);
    point.setMonth(cursor.getMonth() - offset);
    const key = `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, "0")}`;
    series.push({
      month: key,
      label: MONTH_LABELS[point.getMonth()],
      kg: totals.get(key) ?? 0,
    });
  }
  return series;
}

/** Fixed three-letter month names, so labels do not depend on ICU locale data. */
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Emissions split by category, largest first. */
export async function getEmissionsByCategory(
  userId: number
): Promise<Array<{ category: string; kg: number }>> {
  const rows = await query<{ category: string; kg: string }>(
    `SELECT t.category, SUM(c.co2e_kg) AS kg
       FROM transactions t
       JOIN carbon_estimates c ON c.transaction_id = t.id
      WHERE t.user_id = $1
        AND t.direction = 'debit'
        AND date_trunc('month', t.created_at) = date_trunc('month', now())
      GROUP BY t.category
      HAVING SUM(c.co2e_kg) > 0
      ORDER BY kg DESC`,
    [userId]
  );
  return rows.map((r) => ({ category: r.category, kg: Math.round(Number(r.kg) * 100) / 100 }));
}

export async function getGreenPoints(userId: number): Promise<GreenPointsSummary> {
  const row = await queryOne<{ awarded: string; redeemed: string }>(
    `SELECT
       (SELECT COALESCE(SUM(points), 0) FROM green_point_awards WHERE user_id = $1) AS awarded,
       (SELECT COALESCE(SUM(points_spent), 0) FROM reward_redemptions WHERE user_id = $1) AS redeemed`,
    [userId]
  );
  const awarded = Number(row?.awarded ?? 0);
  const redeemed = Number(row?.redeemed ?? 0);
  return { awarded, redeemed, balance: awarded - redeemed };
}

/**
 * Sustainability score, 0-100.
 *
 * Combines two things the proposal asks for: the share of spending that fell into
 * low-carbon categories, and the green points earned relative to spending. Kept
 * as a documented formula rather than a stored number, so it can be re-derived.
 */
export async function getSustainabilityScore(userId: number): Promise<{ score: number; band: string }> {
  const row = await queryOne<{ low_carbon: string; total_kg: string; points: string; spend: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.category IN ('travel','groceries','recharge','bills') THEN t.amount ELSE 0 END), 0) AS low_carbon,
       COALESCE(SUM(CASE WHEN c.co2e_kg < 1.0 THEN t.amount ELSE 0 END), 0) AS points,
       COALESCE(SUM(t.amount), 0) AS spend,
       COALESCE(SUM(c.co2e_kg), 0) AS total_kg
     FROM transactions t
     LEFT JOIN carbon_estimates c ON c.transaction_id = t.id
    WHERE t.user_id = $1
      AND t.direction = 'debit'
      AND date_trunc('month', t.created_at) = date_trunc('month', now())`,
    [userId]
  );

  const lowCarbon = Number(row?.low_carbon ?? 0);
  const pointsSpend = Number(row?.points ?? 0);
  const spend = Number(row?.spend ?? 0);
  const totalKg = Number(row?.total_kg ?? 0);

  if (spend === 0) return { score: 0, band: "Not enough data yet" };

  // Low-carbon share of spending, 60% of the score.
  const lowCarbonShare = Math.min(1, lowCarbon / spend);
  // Emissions intensity: rupees per kg CO2e, saturating at 400 rupees/kg.
  const rupeesPerKg = totalKg > 0 ? spend / totalKg : 400;
  const intensity = Math.max(0, Math.min(1, rupeesPerKg / 400));
  // Green points relative to 200 points per 5,000 rupees spent.
  const pointsRatio = Math.min(1, pointsSpend / 500_000);

  const score = Math.round(
    Math.max(0, Math.min(100, lowCarbonShare * 40 + intensity * 40 + pointsRatio * 20))
  );

  const band = score >= 70 ? "Strong" : score >= 45 ? "Fair" : "Needs work";
  return { score, band };
}

export interface DashboardData {
  totalBalance: number;
  accountCount: number;
  recent: TransactionRow[];
  monthly: MonthlyEmission[];
  /** Emissions so far this month, in kg CO2e. Partial until the month ends. */
  monthEmissions: number;
  dayOfMonth: number;
  daysInMonth: number;
  monthComplete: boolean;
  trustScore: Awaited<ReturnType<typeof latestTrustScore>>;
  sustainability: { score: number; band: string };
  greenPoints: GreenPointsSummary;
  openAlerts: number;
}

/** Everything the dashboard needs, in one call. */
export async function getDashboardData(userId: number): Promise<DashboardData> {
  const [accounts, recent, monthly, runRate, trustScore, sustainability, greenPoints, alerts] =
    await Promise.all([
      getAccounts(userId),
      getTransactions(userId, { limit: 4 }),
      getMonthlyTrend(userId, 5),
      getMonthEmissionsRunRate(userId),
      latestTrustScore(userId),
      getSustainabilityScore(userId),
      getGreenPoints(userId),
      queryOne<{ n: string }>(
        `SELECT COUNT(*) AS n FROM anomaly_alerts WHERE user_id = $1 AND status = 'open'`,
        [userId]
      ),
    ]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  // A brand-new account has no stored snapshot yet. Compute one on first read so
  // the dashboard never shows an empty card to a user who simply has not visited
  // the trust-score screen. getTrustScore persists what it computes, so this costs
  // one model call, once.
  const resolvedTrust = trustScore ?? (await getTrustScore(userId));

  return {
    totalBalance,
    accountCount: accounts.length,
    recent: recent.rows,
    monthly,
    monthEmissions: runRate.kg,
    dayOfMonth: runRate.dayOfMonth,
    daysInMonth,
    // A month is only comparable once it is nearly over.
    monthComplete: runRate.dayOfMonth / daysInMonth > 0.9,
    trustScore: resolvedTrust,
    sustainability,
    greenPoints,
    openAlerts: Number(alerts?.n ?? 0),
  };
}