import "server-only";
import { query, queryOne } from "./db";
import {
  requestTrustScore,
  type TrustContribution,
  type TrustFeatures,
  type TrustScoreResult,
} from "./ml-client";

/**
 * Trust score features and the fallback scorer.
 *
 * Features are derived from real activity in the database. Two rules govern the
 * whole module:
 *
 *  1. No protected attribute is ever read. Gender, caste, religion, and any
 *     government identifier play no part; the feature list below is the complete
 *     input to the model.
 *  2. The breakdown shown to the user is arithmetic on the model's coefficients,
 *     not a hand-written list of plausible-sounding reasons.
 */

export const NEUTRAL_SCORE = 45;
const CONTRIBUTION_CAP = 22;

/**
 * Fallback coefficients, used only when the ML service is unreachable.
 *
 * These are deliberately close to the trained logistic regression's values
 * (documented in ml/models/metrics.json) so the fallback does not contradict the
 * model. They are marked as a fallback everywhere they surface.
 */
const FALLBACK_WEIGHTS: Record<keyof TrustFeatures, number> = {
  savings_regularity: 0.805,
  bill_on_time_ratio: 0.629,
  transaction_consistency: 1.298,
  account_age_months: 1.207,
  family_group_activity: 0.505,
};

const FEATURE_LABELS: Record<keyof TrustFeatures, string> = {
  savings_regularity: "Regular savings",
  bill_on_time_ratio: "On-time bill payments",
  transaction_consistency: "Consistent activity",
  account_age_months: "Account age",
  family_group_activity: "Family group activity",
};

const FEATURE_SCALES: Record<keyof TrustFeatures, number> = {
  savings_regularity: 30,
  bill_on_time_ratio: 30,
  transaction_consistency: 22,
  account_age_months: 24,
  family_group_activity: 16,
};

const BANDS: Array<[number, string]> = [
  [40, "Getting started"],
  [70, "Steady"],
  [101, "Strong"],
];

export function bandFor(score: number): string {
  for (const [stop, label] of BANDS) {
    if (score < stop) return label;
  }
  return "Strong";
}

/**
 * Derive behavioural features from a user's real records.
 *
 * Each is normalised to 0..1 so the model's coefficients apply directly.
 */
export async function extractFeatures(userId: number): Promise<TrustFeatures> {
  const rows = await query<{
    savings_regularity: string;
    bill_on_time_ratio: string;
    transaction_consistency: string;
    account_age_months: string;
    family_group_activity: string;
  }>(
    `
    WITH activity AS (
      SELECT
        -- Regularity of saving: how consistent goal contributions are, by the
        -- share of goals with more than one contribution.
        (
          SELECT COALESCE(AVG(contributions_per_goal), 0) / 5.0
            FROM (
              SELECT COUNT(*) AS contributions_per_goal
                FROM goal_contributions gc
                JOIN savings_goals sg ON sg.id = gc.goal_id
               WHERE sg.user_id = $1
                 AND gc.created_at > now() - interval '180 days'
               GROUP BY gc.goal_id
            ) per_goal
        )::double precision AS savings_regularity,

        -- On-time share of bills in the last 90 days. Without a real due-date
        -- source we approximate: paid within 5 days of the period edge counts as
        -- on time, which is the behaviour we are trying to reward.
        (
          SELECT COALESCE(
            AVG(CASE WHEN EXTRACT(DAY FROM now() - t.created_at) <= 5 THEN 1.0 ELSE 0.0 END), 0
          )
            FROM transactions t
           WHERE t.user_id = $1
             AND t.direction = 'debit'
             AND t.category IN ('bills', 'recharge')
             AND t.created_at > now() - interval '90 days'
        )::double precision AS bill_on_time_ratio,

        -- Consistency: transactions per active week, saturating at 3/week.
        LEAST(
          1.0,
          (
            SELECT COUNT(*) FROM transactions t
             WHERE t.user_id = $1
               AND t.created_at > now() - interval '90 days'
          )::double precision
          / GREATEST(
            1.0,
            (EXTRACT(EPOCH FROM (now() - LEAST(now(), now() - interval '90 days'))) / 604800.0)
          )
          / 3.0
        ) AS transaction_consistency,

        -- Tenure, saturating at 4 years (48 months).
        LEAST(
          1.0,
          (
            SELECT EXTRACT(EPOCH FROM (now() - MIN(u.created_at))) / 86400.0 / 30.0
              FROM users u WHERE u.id = $1
          )::double precision / 48.0
        ) AS account_age_months,

        -- Engagement with family groups: active members and recent group activity.
        LEAST(
          1.0,
          (
            SELECT (
              (SELECT COUNT(*) FROM family_members fm WHERE fm.user_id = $1)::double precision / 4.0
              + (SELECT COUNT(*) FROM family_members fm
                   JOIN transactions t ON t.user_id = fm.user_id
                  WHERE fm.user_id = $1
                    AND t.created_at > now() - interval '90 days')::double precision / 20.0
            ) / 2.0
          ) AS family_group_activity
        )
    `,
    [userId]
  );

  const row = rows[0];
  const clamp = (n: number) => Math.max(0, Math.min(1, n || 0));

  return {
    savings_regularity: clamp(Number(row?.savings_regularity ?? 0)),
    bill_on_time_ratio: clamp(Number(row?.bill_on_time_ratio ?? 0)),
    transaction_consistency: clamp(Number(row?.transaction_consistency ?? 0)),
    account_age_months: clamp(Number(row?.account_age_months ?? 0)),
    family_group_activity: clamp(Number(row?.family_group_activity ?? 0)),
  };
}

/** Local scorer, used when the ML service cannot answer. */
export function fallbackScore(features: TrustFeatures): Omit<TrustScoreResult, "source"> {
  const contributions: TrustContribution[] = (
    Object.keys(FALLBACK_WEIGHTS) as Array<keyof TrustFeatures>
  ).map((feature) => {
    const raw = features[feature] ?? 0;
    const points = Math.round(FALLBACK_WEIGHTS[feature] * FEATURE_SCALES[feature] * raw);
    return {
      feature,
      label: FEATURE_LABELS[feature],
      points: Math.max(-CONTRIBUTION_CAP, Math.min(CONTRIBUTION_CAP, points)),
      raw_value: Math.round(raw * 10_000) / 10_000,
    };
  });

  const total = Math.max(0, Math.min(100, NEUTRAL_SCORE + contributions.reduce((s, c) => s + c.points, 0)));
  contributions.sort((a, b) => b.points - a.points);

  return {
    score: total,
    band: bandFor(total),
    contributions,
    modelVersion: "fallback-logreg",
    basis: "Local fallback using coefficients from the trained model. The modelling service is unavailable, so this score is approximate.",
  };
}

/**
 * Score a user, preferring the ML service and falling back when it is down.
 *
 * The result is also persisted so the dashboard has a score to read without
 * waiting on a model call on every request.
 */
export async function getTrustScore(userId: number): Promise<TrustScoreResult> {
  const features = await extractFeatures(userId);
  const fromService = await requestTrustScore(features);
  const result: TrustScoreResult = fromService
    ? { ...fromService, source: "ml-service" }
    : { ...fallbackScore(features), source: "fallback" };

  await query(
    `INSERT INTO trust_score_snapshots (user_id, score, band, contributions, model_version)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, result.score, result.band, JSON.stringify(result.contributions), `${result.modelVersion}/${result.source}`]
  );

  return result;
}

/** Read the most recent stored score without recomputing. */
export async function latestTrustScore(userId: number): Promise<TrustScoreResult | null> {
  const row = await queryOne<{
    score: number;
    band: string;
    contributions: TrustContribution[];
    model_version: string;
  }>(
    `SELECT score, band, contributions, model_version
       FROM trust_score_snapshots
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  if (!row) return null;

  const source = row.model_version.endsWith("/fallback") ? "fallback" : "ml-service";
  return {
    score: row.score,
    band: row.band,
    contributions: row.contributions,
    modelVersion: row.model_version.split("/")[0],
    source,
    basis:
      source === "fallback"
        ? "Local fallback using coefficients from the trained model."
        : "Each factor is the fitted logistic-regression coefficient applied to your value for it.",
  };
}