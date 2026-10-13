import "server-only";
import { env, log } from "@/lib/env";

/**
 * Client for the FinLeaf ML service (apps/ml).
 *
 * The service is reachable over HTTP so models can be retrained or swapped
 * without touching this application. It is treated as **optional at runtime**:
 * if it is down or slow, the caller still gets a usable answer from a
 * documented rule-based fallback, and the score is labelled as coming from
 * that fallback rather than from a model. A degraded system that tells the
 * truth about being degraded is preferable to one that fails a loan applicant
 * because a sidecar container is down.
 */

export type TrustModelName = "gb" | "lr";

export interface TrustFeatures {
  savings_regularity: number;
  on_time_bill_ratio: number;
  txn_consistency: number;
  account_age_days: number;
  group_activity: number;
  avg_balance_stability: number;
  monthly_txn_count: number;
  repayment_history: number;
}

export interface TrustFactor {
  factor: string;
  label: string;
  points: number;
  detail: string;
}

export type TrustSource = "HistGradientBoostingClassifier" | "LogisticRegression" | "fallback-rules";

export interface TrustScoreResult {
  score: number;
  source: TrustSource;
  probability: number;
  topFactors: TrustFactor[];
  allFactors: TrustFactor[];
  explanationMethod: string;
}

export interface AnomalyFeatures {
  amount_log: number;
  hour_of_day: number;
  rapid_repeat: number;
  new_counterparty: number;
  category_rarity: number;
}

export interface AnomalyResult {
  anomalyScore: number;
  isAnomalous: boolean;
  reasons: string[];
  action: "review" | "auto_cleared";
  source: "IsolationForest" | "fallback-rules";
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T | null> {
  const { ML_SERVICE_URL } = env();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ML_SERVICE_URL.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      log("warn", "ml service returned an error", { path, status: response.status });
      return null;
    }

    return (await response.json()) as T;
  } catch {
    log("warn", "ml service unreachable", { path });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Rule-based trust score used when the ML service is unavailable.
 *
 * This is a transparent weighted sum over the same eight features, with the
 * weights shown to the user so the score is explainable without the model. It
 * is intentionally simple and is never presented as a model output.
 */
export const FALLBACK_WEIGHTS: Record<keyof TrustFeatures, number> = {
  savings_regularity: 0.22,
  on_time_bill_ratio: 0.2,
  txn_consistency: 0.12,
  account_age_days: 0.14,
  group_activity: 0.1,
  avg_balance_stability: 0.08,
  monthly_txn_count: 0.06,
  repayment_history: 0.08,
};

const FACTOR_LABELS: Record<keyof TrustFeatures, string> = {
  savings_regularity: "Regular savings",
  on_time_bill_ratio: "On-time bill payments",
  txn_consistency: "Consistent transactions",
  account_age_days: "Account age",
  group_activity: "Group participation",
  avg_balance_stability: "Stable balance",
  monthly_txn_count: "Transaction activity",
  repayment_history: "Repayment record",
};

function detailFor(feature: keyof TrustFeatures, value: number): string {
  if (feature === "account_age_days") {
    const days = Math.round(value * 365);
    return days <= 0 ? "Account opened recently" : `${days} days old`;
  }
  if (feature === "monthly_txn_count") {
    const count = Math.round(value * 30);
    return count <= 0 ? "No activity yet" : `${count} transactions this month`;
  }
  const pct = Math.round(value * 100);
  if (pct >= 75) return `Strong (${pct}%)`;
  if (pct >= 45) return `Fair (${pct}%)`;
  if (pct > 0) return `Limited (${pct}%)`;
  return "No activity yet";
}

export function fallbackTrustScore(features: TrustFeatures): TrustScoreResult {
  let weighted = 0;
  let totalWeight = 0;

  for (const key of Object.keys(FALLBACK_WEIGHTS) as Array<keyof TrustFeatures>) {
    const weight = FALLBACK_WEIGHTS[key];
    const clamped = Math.min(1, Math.max(0, features[key] ?? 0));
    weighted += clamped * weight;
    totalWeight += weight;
  }

  const probability = totalWeight > 0 ? weighted / totalWeight : 0;

  const allFactors = (Object.keys(FALLBACK_WEIGHTS) as Array<keyof TrustFeatures>)
    .map((key) => {
      const clamped = Math.min(1, Math.max(0, features[key] ?? 0));
      return {
        factor: key,
        label: FACTOR_LABELS[key],
        // Contribution expressed in points on the same 0-100 scale as the score.
        points: Math.round((clamped - 0.5) * 2 * FALLBACK_WEIGHTS[key] * 100 * 10) / 10,
        detail: detailFor(key, features[key] ?? 0),
      };
    })
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return {
    score: Math.round(probability * 100),
    source: "fallback-rules",
    probability,
    topFactors: allFactors.slice(0, 4),
    allFactors,
    explanationMethod:
      "Weighted behaviour rules, used because the scoring service was unavailable.",
  };
}

/**
 * Scores a user 0-100 and explains the score.
 *
 * `model: "gb"` requests the gradient-boosted model (the stronger of the two);
 * `"lr"` requests the interpretable logistic-regression scorecard.
 */
export async function scoreTrust(
  features: TrustFeatures,
  options: { model?: TrustModelName } = {},
): Promise<TrustScoreResult> {
  const model = options.model ?? "gb";
  const timeout = env().ML_SERVICE_TIMEOUT_MS;

  const raw = await post<{
    score: number;
    probability: number;
    model: string;
    explanation_method: string;
    top_factors: Array<{ factor: string; label: string; points: number; detail: string }>;
    all_factors: Array<{ factor: string; label: string; points: number; detail: string }>;
  }>("/ml/trust-score", { ...features, model }, timeout);

  if (!raw || typeof raw.score !== "number") {
    return fallbackTrustScore(features);
  }

  return {
    score: Math.min(100, Math.max(0, raw.score)),
    source: raw.model as TrustSource,
    probability: raw.probability ?? raw.score / 100,
    topFactors: raw.top_factors ?? [],
    allFactors: raw.all_factors ?? raw.top_factors ?? [],
    explanationMethod: raw.explanation_method ?? "per-factor contribution in probability points",
  };
}

/**
 * Rule-based anomaly heuristic used when the ML service is unavailable.
 *
 * Mirrors the thresholds the model version documents so the fallback flags the
 * same obviously-unusual patterns, and says so rather than claiming to be a
 * model.
 */
export function fallbackAnomalyScore(features: AnomalyFeatures): AnomalyResult {
  const reasons: string[] = [];
  let score = 0;

  if (features.amount_log > 7.5) {
    score += 0.4;
    reasons.push("Unusually large amount");
  }
  if (features.hour_of_day < 5 || features.hour_of_day > 23) {
    score += 0.25;
    reasons.push("Unusual time of day");
  }
  if (features.rapid_repeat > 0.6) {
    score += 0.25;
    reasons.push("Rapid repeated transaction");
  }
  if (features.new_counterparty > 0.5) {
    score += 0.2;
    reasons.push("First-time recipient");
  }
  if (features.category_rarity > 0.65) {
    score += 0.15;
    reasons.push("Unusual spending category");
  }

  const bounded = Math.min(1, score);
  return {
    anomalyScore: Math.round(bounded * 10_000) / 10_000,
    isAnomalous: bounded > 0.5,
    reasons: reasons.length ? reasons : ["Pattern differs slightly from your usual activity"],
    action: bounded > 0.5 ? "review" : "auto_cleared",
    source: "fallback-rules",
  };
}

export async function scoreAnomaly(
  features: AnomalyFeatures,
): Promise<AnomalyResult> {
  const raw = await post<{
    anomaly_score: number;
    is_anomalous: boolean;
    reasons: string[];
    action: "review" | "auto_cleared";
  }>("/ml/anomaly-score", features, env().ML_SERVICE_TIMEOUT_MS);

  if (!raw || typeof raw.anomaly_score !== "number") {
    return fallbackAnomalyScore(features);
  }

  return {
    anomalyScore: raw.anomaly_score,
    isAnomalous: raw.is_anomalous,
    reasons: raw.reasons ?? [],
    action: raw.action ?? (raw.is_anomalous ? "review" : "auto_cleared"),
    source: "IsolationForest",
  };
}

export interface ModelMetrics {
  logistic_regression: Record<string, number>;
  gradient_boosting: Record<string, number>;
  anomaly_detector: Record<string, number | string>;
  trained_on?: string;
}

/**
 * Held-out metrics for the deployed models.
 *
 * Returns null when the service is unreachable so the UI can state that metrics
 * are unavailable rather than showing stale or invented numbers.
 */
export async function fetchModelMetrics(): Promise<ModelMetrics | null> {
  const { ML_SERVICE_URL, ML_SERVICE_TIMEOUT_MS } = env();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ML_SERVICE_URL.replace(/\/+$/, "")}/model/metrics`,
      { signal: controller.signal, cache: "no-store" },
    );
    if (!response.ok) return null;
    return (await response.json()) as ModelMetrics;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function mlHealth(): Promise<boolean> {
  const { ML_SERVICE_URL, ML_SERVICE_TIMEOUT_MS } = env();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_SERVICE_TIMEOUT_MS);
  try {
    const response = await fetch(`${ML_SERVICE_URL.replace(/\/+$/, "")}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
