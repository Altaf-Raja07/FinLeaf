import "server-only";
import { env, log } from "@/lib/env";
import {
  co2eFor,
  EMISSION_FACTORS,
  greenPointsFor,
  isEmissionCategory,
  labelFor,
  noteFor,
  type EmissionCategory,
} from "./factors";

/**
 * Carbon estimation.
 *
 * Preferred path: ask Climatiq, whose spend-based factors are validated
 * against the GHG Protocol. Fallback path: the static table in ./factors.
 *
 * The fallback is not an error path — it is the designed behaviour. Categories
 * outside the free quota, a missing API key, an outage or a timeout all resolve
 * to the static table, and every transaction records which source produced its
 * number in `Transaction.co2eSource` so the two can be audited separately.
 */

export type Co2eSource = "static-table" | "climatiq";

export interface Co2eEstimate {
  co2eKg: number;
  source: Co2eSource;
  category: EmissionCategory;
  label: string;
  note: string;
  greenPoints: number;
  /** Present only when a remote lookup was attempted and did not succeed. */
  fallbackReason?: string;
}

/** Categories the static table can answer for directly. */
export function hasStaticFactor(category: string): boolean {
  return isEmissionCategory(category);
}

/**
 * Climatiq spend-based estimate.
 *
 * Returns null on any failure — missing key, non-OK response, unparseable body,
 * timeout, or a response without a usable figure. Callers treat null as
 * "fall back to the static table", never as a failure of the request.
 */
async function estimateViaClimatiq(
  category: EmissionCategory,
  amountInr: number,
): Promise<number | null> {
  const { CLIMATIQ_API_KEY, CLIMATIQ_API_URL, CLIMATIQ_TIMEOUT_MS } = env();
  if (!CLIMATIQ_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIMATIQ_TIMEOUT_MS);

  try {
    const response = await fetch(CLIMATIQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currency: "INR",
        items: [{ category: category.toLowerCase(), amount: amountInr }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      log("warn", "climatiq estimate unavailable", {
        status: response.status,
        category,
      });
      return null;
    }

    const payload = (await response.json()) as {
      data?: { co2e_kg?: number; co2eKg?: number };
    };

    const value = payload?.data?.co2e_kg ?? payload?.data?.co2eKg;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    log("warn", "climatiq estimate failed", { category });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Estimates the CO2e for a spend.
 *
 * `preferRemote: false` skips the network call entirely, which is what the
 * transaction write path uses: the posting transaction should not hold a
 * database row lock open across an HTTP round trip. The stored figure then
 * always comes from the static table, and a backfill job can enrich historical
 * rows from Climatiq out of band.
 */
export async function estimateCo2e(
  category: string,
  amountInr: number,
  options: { preferRemote?: boolean; locale?: string } = {},
): Promise<Co2eEstimate> {
  const { preferRemote = true, locale = "en" } = options;
  const key: EmissionCategory = isEmissionCategory(category) ? category : "OTHER";

  const base: Co2eEstimate = {
    co2eKg: co2eFor(key, amountInr),
    source: "static-table",
    category: key,
    label: labelFor(key, locale),
    note: noteFor(key, locale),
    greenPoints: greenPointsFor(key),
  };

  if (!preferRemote) return base;

  const remote = await estimateViaClimatiq(key, amountInr);
  if (remote === null) return base;

  return {
    ...base,
    co2eKg: Math.round(remote * 10_000) / 10_000,
    source: "climatiq",
  };
}

/** The static table, for display on the methodology screen and for audits. */
export function factorTable() {
  return Object.entries(EMISSION_FACTORS).map(([category, entry]) => ({
    category,
    factorPer100Inr: entry.factorPer100Inr,
    label: entry.labels.en,
    greenPoints: entry.greenPoints,
  }));
}

export const METHODOLOGY =
  "GHG Protocol Scope 3.1 category-based estimation. Emissions are inferred from spending categories, not measured. Factors are indicative order-of-magnitude estimates.";
