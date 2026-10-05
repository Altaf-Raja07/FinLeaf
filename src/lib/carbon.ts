import type { Paise } from "./money";

/**
 * Spend-based carbon estimation.
 *
 * Method (proposal section 7): every transaction is tagged with a category, each
 * category has an emission factor expressed in kg CO2e per 100 rupees, and
 *
 *     estimated CO2e = amount_in_rupees / 100 * factor_kg_per_100rupees
 *
 * Worked example from the proposal: 2,000 rupees of fuel at 2.5 kg per 100
 * rupees = 2000 * 0.025 = 50 kg CO2e. That arithmetic is reproduced by
 * `verifyProposalWorkedExample` in the test script.
 *
 * This is a proxy estimate, not a measurement. Real emissions depend on the
 * exact product, distance travelled, and energy source, which a spending
 * category cannot know. The UI labels these figures "estimated" everywhere.
 *
 * Factors below are indicative values chosen to be defensible and internally
 * consistent for a demo. They are not a substitute for the CEA or lifecycle
 * datasets named in the proposal, and are documented as such.
 */

export type CarbonCategory =
  | "fuel"
  | "travel"
  | "groceries"
  | "dining"
  | "electronics"
  | "bills"
  | "recharge"
  | "health"
  | "transfer";

export interface CarbonFactor {
  category: CarbonCategory;
  /** kg CO2e per 100 rupees spent in this category. */
  kgPer100Rupees: number;
  /** Plain-language note shown in the "how this is calculated" view. */
  basis: string;
}

/**
 * Static fallback table. This is the source of truth when no emissions API is
 * configured or the API call fails; see `estimateCarbonWithApi`.
 */
export const CARBON_FACTORS: Record<CarbonCategory, CarbonFactor> = {
  fuel: {
    category: "fuel",
    kgPer100Rupees: 2.5,
    basis: "Petrol and diesel, per the proposal's worked example.",
  },
  travel: {
    category: "travel",
    kgPer100Rupees: 0.4,
    basis: "Bus and train fares carry far less emissions per rupee than air travel.",
  },
  groceries: {
    category: "groceries",
    kgPer100Rupees: 0.5,
    basis: "Predominantly local and seasonal produce, which is the low end of food emissions.",
  },
  dining: {
    category: "dining",
    kgPer100Rupees: 0.5,
    basis: "Similar to groceries but weighted slightly higher for packaging and cold chain.",
  },
  electronics: {
    category: "electronics",
    kgPer100Rupees: 3.2,
    basis: "High embodied emissions from manufacture, which dominate a device's lifetime.",
  },
  bills: {
    category: "bills",
    kgPer100Rupees: 0.4,
    basis: "Grid electricity in India is largely coal-based; a typical household tariff rate.",
  },
  recharge: {
    category: "recharge",
    kgPer100Rupees: 0.1,
    basis: "Prepaid mobile credit is mostly a network cost, not a physical good.",
  },
  health: {
    category: "health",
    kgPer100Rupees: 0.3,
    basis: "Consultations and common medicines.",
  },
  transfer: {
    category: "transfer",
    kgPer100Rupees: 0,
    basis: "Moving money between own accounts has no emissions of its own.",
  },
};

export interface CarbonEstimate {
  category: CarbonCategory;
  amountPaise: Paise;
  /** The factor actually applied, echoed back so the UI can show its working. */
  kgPer100Rupees: number;
  co2eKg: number;
  source: "static" | "api";
  basis: string;
}

export function isCarbonCategory(value: string): value is CarbonCategory {
  return Object.prototype.hasOwnProperty.call(CARBON_FACTORS, value);
}

/**
 * Estimate emissions from a static factor.
 *
 * Paise are divided by 100 to get rupees, then scaled by the per-100-rupee
 * factor, so no unit is ever mixed up.
 */
export function estimateCarbon(category: CarbonCategory, amountPaise: Paise): CarbonEstimate {
  const factor = CARBON_FACTORS[category];
  const rupees = amountPaise / 100;
  const co2eKg = (rupees / 100) * factor.kgPer100Rupees;
  return {
    category,
    amountPaise,
    kgPer100Rupees: factor.kgPer100Rupees,
    co2eKg: round4(co2eKg),
    source: "static",
    basis: factor.basis,
  };
}

/**
 * Categories that earn green points, and how many.
 *
 * Kept separate from the carbon table: a low-carbon category is what earns
 * points, but the two must not be conflated, since electronics is high-carbon
 * yet a necessary purchase.
 */
const GREEN_POINTS: Record<CarbonCategory, number> = {
  travel: 12, // bus and train over a car
  groceries: 8, // local produce
  recharge: 4, // paperless
  bills: 6, // e-bills instead of paper
  health: 2,
  fuel: 0,
  dining: 0,
  electronics: 0,
  transfer: 0,
};

/** Points for a transaction. Zero means "not a qualifying purchase". */
export function greenPointsFor(category: CarbonCategory, amountPaise: Paise): number {
  const perRupee = GREEN_POINTS[category];
  if (perRupee === 0) return 0;
  // One point per 100 rupees, rounded down, so small purchases still qualify.
  return Math.floor(amountPaise / 10000) * perRupee;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}