import "server-only";

/**
 * Client for the Python ML service.
 *
 * The service is optional by design. When it is unreachable or disabled, callers
 * fall back to the local scoring logic in `trust.ts` rather than failing the
 * request, and the response says which path produced the number. A user must
 * never see an error page because a modelling service is down.
 *
 * API keys are never involved here; this is an internal service on localhost.
 */

const ML_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000";
const ML_ENABLED = process.env.ML_ENABLED !== "false";
const TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 3000);

export const TRUST_FEATURES = [
  "savings_regularity",
  "bill_on_time_ratio",
  "transaction_consistency",
  "account_age_months",
  "family_group_activity",
] as const;

export type TrustFeature = (typeof TRUST_FEATURES)[number];
export type TrustFeatures = Record<TrustFeature, number>;

export interface TrustContribution {
  feature: TrustFeature;
  label: string;
  points: number;
  raw_value: number;
  capped?: boolean;
}

export interface TrustScoreResult {
  score: number;
  band: string;
  contributions: TrustContribution[];
  modelVersion: string;
  /** Which component produced the number, so the UI can be honest about it. */
  source: "ml-service" | "fallback";
  basis: string;
}

export interface AnomalyAlert {
  reference: string;
  anomalyScore: number;
  reasons: string[];
}

export interface AnomalyResult {
  alerts: AnomalyAlert[];
  /** The model's fitted decision boundary; exposed so a flag is explainable. */
  threshold: number;
  /** Contamination rate the model was fitted with, i.e. expected flag rate. */
  contamination: number;
  flagged: number;
  submitted: number;
  modelVersion: string;
  note: string;
  source: "ml-service" | "fallback";
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  if (!ML_ENABLED) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ML_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: boolean } & T;
    return payload.ok === false ? null : payload;
  } catch {
    // Network error, timeout, or malformed response: fall back silently.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function mlHealth(): Promise<{ reachable: boolean; models?: string[] }> {
  if (!ML_ENABLED) return { reachable: false };
  try {
    const response = await fetch(`${ML_URL}/health`, { cache: "no-store" });
    if (!response.ok) return { reachable: false };
    const data = (await response.json()) as { loaded?: string[] };
    return { reachable: true, models: data.loaded ?? [] };
  } catch {
    return { reachable: false };
  }
}

/** Ask the service for a trust score. Returns null when it cannot answer. */
export async function requestTrustScore(
  features: TrustFeatures
): Promise<Omit<TrustScoreResult, "source"> | null> {
  const payload = await post<Omit<TrustScoreResult, "source">>("/trust-score", { features });
  if (!payload || typeof payload.score !== "number") return null;

  // The service also returns fields we do not surface (probability, intercept,
  // cap). Drop them rather than letting them leak into the typed shape, and fail
  // loudly if a field we do depend on is missing, instead of persisting
  // "undefined" as if it were a model version.
  const { score, band, contributions, basis } = payload;
  if (typeof band !== "string" || !Array.isArray(contributions) || typeof basis !== "string") {
    return null;
  }

  // The service speaks snake_case; the app speaks camelCase. Map explicitly rather
  // than casting, so a renamed field on either side fails here instead of
  // silently persisting "undefined" as a model version.
  const modelVersion = (payload as Record<string, unknown>).model_version;
  if (typeof modelVersion !== "string" || modelVersion.length === 0) {
    console.warn("[ml-client] trust-score response had no model_version; using fallback");
    return null;
  }

  return { score, band, contributions, modelVersion, basis };
}

export interface AnomalyInput {
  reference: string;
  amount: number;
  hour: number;
  burst: number;
}

export async function requestAnomalyScores(
  transactions: AnomalyInput[]
): Promise<Omit<AnomalyResult, "source"> | null> {
  const payload = await post<Omit<AnomalyResult, "source">>("/anomaly-score", { transactions });
  if (!payload || !Array.isArray(payload.alerts)) return null;

  // Map the snake_case service response explicitly rather than casting, so a
  // renamed field fails here instead of writing a null into the database.
  const raw = payload as unknown as Record<string, unknown>;
  if (typeof raw.model_version !== "string") {
    console.warn("[ml-client] anomaly response had no model_version");
    return null;
  }

  // Alert fields are snake_case on the wire too. Normalise here rather than at
  // each call site, so a renamed field cannot write a null into a NOT NULL
  // column somewhere further down.
  const alerts: AnomalyAlert[] = payload.alerts.map((a) => {
    const row = a as unknown as Record<string, unknown>;
    return {
      reference: String(row.reference ?? ""),
      anomalyScore: typeof row.anomaly_score === "number" ? row.anomaly_score : 0,
      reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
    };
  });

  return {
    alerts,
    threshold: typeof raw.threshold === "number" ? raw.threshold : 0,
    contamination: typeof raw.contamination === "number" ? raw.contamination : 0,
    flagged: typeof raw.flagged === "number" ? raw.flagged : payload.alerts.length,
    submitted: typeof raw.submitted === "number" ? raw.submitted : transactions.length,
    modelVersion: raw.model_version,
    note: typeof raw.note === "string" ? raw.note : "",
  };
}