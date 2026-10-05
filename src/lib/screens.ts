import "server-only";
import { query, queryOne } from "./db";

/**
 * Queries for the screens beyond the dashboard.
 *
 * All take an explicit userId that the caller takes from the session, so no query
 * can accidentally read another user's records.
 */

export interface GoalRow {
  id: number;
  title: string;
  target: number;
  saved: number;
  weekly: number;
  percent: number;
}

export async function getGoals(userId: number): Promise<GoalRow[]> {
  const rows = await query<{ id: number; title: string; target_amount: string; saved_amount: string; weekly_amount: string }>(
    `SELECT id, title, target_amount, saved_amount, weekly_amount
       FROM savings_goals WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => {
    const target = Number(r.target_amount);
    const saved = Number(r.saved_amount);
    return {
      id: r.id,
      title: r.title,
      target,
      saved,
      weekly: Number(r.weekly_amount),
      percent: target === 0 ? 0 : Math.min(100, Math.round((saved / target) * 100)),
    };
  });
}

/** Contribution history for a goal, newest first. */
export async function getGoalContributions(userId: number, goalId: number) {
  return query<{ amount: string; created_at: Date }>(
    `SELECT gc.amount, gc.created_at
       FROM goal_contributions gc
       JOIN savings_goals sg ON sg.id = gc.goal_id
      WHERE sg.user_id = $1 AND gc.goal_id = $2
      ORDER BY gc.created_at DESC
      LIMIT 20`,
    [userId, goalId]
  ).then((rows) => rows.map((r) => ({ amount: Number(r.amount), createdAt: r.created_at })));
}

export interface LoanRow {
  id: number;
  principal: number;
  status: "submitted" | "in_review" | "approved" | "repaid" | "declined";
  trustScoreAtDecision: number | null;
  createdAt: string;
  decidedAt: string | null;
}

export async function getLoans(userId: number): Promise<LoanRow[]> {
  const rows = await query<{
    id: number;
    principal: string;
    status: LoanRow["status"];
    trust_score_at_decision: number | null;
    created_at: Date;
    decided_at: Date | null;
  }>(
    `SELECT id, principal, status, trust_score_at_decision, created_at, decided_at
       FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    principal: Number(r.principal),
    status: r.status,
    trustScoreAtDecision: r.trust_score_at_decision,
    createdAt: r.created_at.toISOString(),
    decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
  }));
}

/** Loan limit derived from the trust score. All amounts are PAISE. */
export interface LoanEligibility {
  limitPaise: number;
  instalments: number;
  instalmentPaise: number;
}

/**
 * Loan eligibility from the trust score.
 *
 * The bands are documented constants of the prototype, not a lending decision.
 * Capacity rises with the score because that is the proposal's whole premise:
 * behaviour substitutes for a credit history. Nothing here constitutes credit
 * approval, and the UI says so.
 *
 * Amounts are in paise to match every other money value in the app. Returning
 * rupees here was a real bug: the API compared paise against rupees and rejected
 * every application as far above the limit.
 */
export function eligibleLoanAmount(trustScore: number): LoanEligibility {
  const MAX_LOAN_RUPEES = 50_000;
  const rawRupees = (trustScore / 100) * MAX_LOAN_RUPEES;
  // Round to the nearest 500 rupees for a figure a lender would actually quote.
  const limitRupees = Math.round(rawRupees / 500) * 500;
  const instalments = 6;
  return {
    limitPaise: limitRupees * 100,
    instalments,
    instalmentPaise: Math.round((limitRupees / instalments) * 100),
  };
}

export interface LessonRow {
  id: number;
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  attempts: number;
  passed: boolean;
  bestScore: number | null;
}

export async function getLessons(userId: number): Promise<LessonRow[]> {
  const rows = await query<{
    id: number;
    slug: string;
    title: string;
    summary: string;
    minutes: number;
    attempts: number;
    passed: boolean | null;
    best_correct: number | null;
    last_total: number | null;
  }>(
    `SELECT l.id, l.slug, l.title, l.summary, l.minutes,
            COUNT(qa.id)::int AS attempts,
            BOOL_OR(qa.passed) AS passed,
            MAX(qa.correct)::int AS best_correct,
            (ARRAY_AGG(qa.total ORDER BY qa.created_at DESC))[1] AS last_total
       FROM lessons l
       LEFT JOIN quiz_attempts qa ON qa.lesson_id = l.id AND qa.user_id = $1
      GROUP BY l.id
      ORDER BY l.id`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    minutes: r.minutes,
    attempts: Number(r.attempts),
    passed: r.passed ?? false,
    bestScore: r.best_correct === null ? null : Number(r.best_correct),
  }));
}

export interface BadgeRow {
  code: string;
  title: string;
  description: string;
  earned: boolean;
}

const BADGE_CATALOGUE: Array<Omit<BadgeRow, "earned">> = [
  { code: "first-transfer", title: "First transfer", description: "Send your first transfer" },
  { code: "goal-crusher", title: "Goal crusher", description: "Save 10,000 rupees towards a goal" },
  { code: "on-time-payer", title: "On-time payer", description: "Pay every bill on time for a month" },
  { code: "quiz-whiz", title: "Quiz whiz", description: "Pass all three money lessons" },
  { code: "green-shopper", title: "Green shopper", description: "Earn 500 green points" },
  { code: "carbon-cutter", title: "Carbon cutter", description: "Keep a month under 20 kg CO2e" },
];

export async function getBadges(userId: number): Promise<BadgeRow[]> {
  const rows = await query<{ badge_code: string }>(
    `SELECT badge_code FROM user_badges WHERE user_id = $1`,
    [userId]
  );
  const earned = new Set(rows.map((r) => r.badge_code));
  return BADGE_CATALOGUE.map((b) => ({ ...b, earned: earned.has(b.code) }));
}

export interface RewardRow {
  id: number;
  code: string;
  title: string;
  description: string;
  pointsCost: number;
  kind: string;
}

export async function getRewards(): Promise<RewardRow[]> {
  const rows = await query<{ id: number; code: string; title: string; description: string; points_cost: number; kind: string }>(
    `SELECT id, code, title, description, points_cost, kind FROM rewards ORDER BY points_cost`,
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    pointsCost: r.points_cost,
    kind: r.kind,
  }));
}

export interface OffsetProjectRow {
  id: number;
  code: string;
  title: string;
  location: string;
  pointsCost: number;
  co2eKg: number;
  outcome: string;
}

export async function getOffsetProjects(): Promise<OffsetProjectRow[]> {
  const rows = await query<{
    id: number;
    code: string;
    title: string;
    location: string;
    points_cost: number;
    co2e_kg: string;
    outcome: string;
  }>(`SELECT id, code, title, location, points_cost, co2e_kg, outcome FROM offset_projects ORDER BY points_cost`);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    location: r.location,
    pointsCost: r.points_cost,
    co2eKg: Number(r.co2e_kg),
    outcome: r.outcome,
  }));
}

export interface PeerRow {
  userId: number;
  name: string;
  kg: number;
  points: number;
  isYou: boolean;
  /** Position when sorted by footprint, lowest first. */
  rank: number;
}

/**
 * Peer comparison for the leaderboard.
 *
 * Emissions and points are computed from each user's real records, so the board
 * is a consequence of the data rather than a stored ranking. A user with no
 * transactions this month is excluded rather than shown as zero, which would be
 * indistinguishable from having genuinely spent nothing.
 */
export async function getLeaderboard(currentUserId: number): Promise<PeerRow[]> {
  const rows = await query<{
    id: number;
    full_name: string;
    kg: string;
    points: string;
  }>(
    `SELECT u.id, u.full_name,
            COALESCE((
              SELECT SUM(c.co2e_kg) FROM transactions t
                JOIN carbon_estimates c ON c.transaction_id = t.id
               WHERE t.user_id = u.id AND t.direction = 'debit'
                 AND date_trunc('month', t.created_at) = date_trunc('month', now())
            ), 0) AS kg,
            COALESCE((SELECT SUM(points) FROM green_point_awards WHERE user_id = u.id), 0)
              - COALESCE((SELECT SUM(points_spent) FROM reward_redemptions WHERE user_id = u.id), 0) AS points
       FROM users u
      WHERE EXISTS (
              SELECT 1 FROM transactions t
               WHERE t.user_id = u.id AND t.direction = 'debit'
                 AND date_trunc('month', t.created_at) = date_trunc('month', now())
            )
      ORDER BY kg ASC`,
  );

  return rows.map((r, index) => ({
    userId: r.id,
    name: r.full_name,
    kg: Math.round(Number(r.kg) * 10) / 10,
    points: Number(r.points),
    isYou: r.id === currentUserId,
    rank: index + 1,
  }));
}

export interface FamilyMemberRow {
  userId: number;
  name: string;
  role: string;
  visibility: string;
}

export async function getFamilyGroup(userId: number): Promise<{
  name: string;
  balance: number;
  members: FamilyMemberRow[];
} | null> {
  const group = await queryOne<{ id: number; name: string }>(
    `SELECT g.id, g.name FROM family_groups g
       JOIN family_members fm ON fm.group_id = g.id
      WHERE fm.user_id = $1 LIMIT 1`,
    [userId]
  );
  if (!group) return null;

  const balanceRow = await queryOne<{ total: string | null }>(
    `SELECT COALESCE(SUM(balance), 0) AS total FROM accounts WHERE kind = 'group' AND user_id = $1`,
    [userId]
  );

  const members = await query<{ user_id: number; full_name: string; role: string; visibility: string }>(
    `SELECT fm.user_id, u.full_name, fm.role, fm.visibility
       FROM family_members fm JOIN users u ON u.id = fm.user_id
      WHERE fm.group_id = $1
      ORDER BY CASE fm.role WHEN 'owner' THEN 0 ELSE 1 END, u.full_name`,
    [group.id]
  );

  return {
    name: group.name,
    balance: Number(balanceRow?.total ?? 0),
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.full_name,
      role: m.role,
      visibility: m.visibility,
    })),
  };
}

export interface EndorsementRow {
  id: number;
  fromName: string;
  reason: string;
  points: number;
  createdAt: string;
}

export async function getEndorsements(userId: number): Promise<EndorsementRow[]> {
  const rows = await query<{
    id: number;
    full_name: string;
    reason: string;
    points: number;
    created_at: Date;
  }>(
    `SELECT e.id, u.full_name, e.reason, e.points, e.created_at
       FROM endorsements e JOIN users u ON u.id = e.endorser_id
      WHERE e.endorsee_id = $1 ORDER BY e.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    fromName: r.full_name,
    reason: r.reason,
    points: r.points,
    createdAt: r.created_at.toISOString(),
  }));
}

export interface AgentRow {
  id: number;
  name: string;
  kind: string;
  distanceKm: number;
  opensAt: string | null;
  closesAt: string | null;
}

export async function getAgents(userId: number): Promise<AgentRow[]> {
  const rows = await query<{
    id: number;
    name: string;
    agent_kind: string;
    distance_km: string;
    opens_at: string | null;
    closes_at: string | null;
  }>(
    `SELECT id, name, agent_kind, distance_km, opens_at, closes_at
       FROM counterparties WHERE owner_user_id = $1 AND is_agent
      ORDER BY distance_km`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.agent_kind ?? "Agent",
    distanceKm: Number(r.distance_km),
    opensAt: r.opens_at,
    closesAt: r.closes_at,
  }));
}

export interface AnomalyRow {
  id: number;
  transactionId: number | null;
  score: number;
  reasons: string[];
  status: string;
  createdAt: string;
  merchant: string | null;
  amount: number | null;
  category: string | null;
}

/** Anomaly alerts for the review screen, newest first. */
export async function getAnomalyAlerts(userId: number): Promise<AnomalyRow[]> {
  const rows = await query<{
    id: number;
    transaction_id: number | null;
    score: string;
    reasons: unknown;
    status: string;
    created_at: Date;
    merchant: string | null;
    amount: string | null;
    category: string | null;
  }>(
    `SELECT a.id, a.transaction_id, a.score, a.reasons, a.status, a.created_at,
            t.merchant, t.amount, t.category
       FROM anomaly_alerts a
       LEFT JOIN transactions t ON t.id = a.transaction_id
      WHERE a.user_id = $1
      ORDER BY a.status = 'open' DESC, a.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    score: Number(r.score),
    reasons: Array.isArray(r.reasons) ? (r.reasons as string[]) : [],
    status: r.status,
    createdAt: r.created_at.toISOString(),
    merchant: r.merchant,
    amount: r.amount === null ? null : Number(r.amount),
    category: r.category,
  }));
}

export interface NotificationRow {
  id: number;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(userId: number): Promise<NotificationRow[]> {
  const rows = await query<{ id: number; title: string; body: string; read_at: Date | null; created_at: Date }>(
    `SELECT id, title, body, read_at, created_at FROM notifications
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    read: r.read_at !== null,
    createdAt: r.created_at.toISOString(),
  }));
}

export interface CounterpartyRow {
  id: number;
  name: string;
  phone: string;
  userId: number | null;
}

/** People the primary user can send money to, i.e. other seeded users. */
export async function getRecipients(userId: number): Promise<CounterpartyRow[]> {
  const rows = await query<{ id: number; name: string; phone: string; user_id: number | null }>(
    `SELECT c.id, c.name, c.phone, u.id AS user_id
       FROM counterparties c
       LEFT JOIN users u ON u.phone = c.phone AND u.id <> $1
      WHERE c.owner_user_id = $1 AND c.is_agent = FALSE
      ORDER BY c.name`,
    [userId]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, userId: r.user_id }));
}

/** Categories that actually appear in a user's history, for filter dropdowns. */
export async function getUsedCategories(userId: number): Promise<string[]> {
  const rows = await query<{ category: string }>(
    `SELECT DISTINCT category FROM transactions WHERE user_id = $1 ORDER BY category`,
    [userId]
  );
  return rows.map((r) => r.category);
}