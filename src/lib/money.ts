/**
 * Money helpers.
 *
 * All amounts are stored and computed as integer paise (`bigint` in the database,
 * `number` in memory). Rupees never appear as a float: 0.1 + 0.2 must not be
 * able to cost a customer one paisa.
 */

export type Paise = number;

export const RUPEES_PER_100 = 100;

/** Convert a rupee amount (may be fractional, e.g. 12.34) to paise. */
export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) throw new Error(`invalid rupee amount: ${rupees}`);
  return Math.round(rupees * 100);
}

/** Convert paise back to rupees, for display only. */
export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format paise as a rupee string, e.g. 1245000 -> "₹12,450.00".
 * Indian digit grouping (lakh/crore) comes from the `en-IN` locale.
 */
export function formatMoney(paise: Paise, options: { sign?: "auto" | "never" } = {}): string {
  const rupees = paiseToRupees(paise);
  const body = inrFormatter.format(Math.abs(rupees));
  if (options.sign === "never" || rupees === 0) return body;
  return rupees < 0 ? `-${body}` : `+${body}`;
}

/** Format without a leading sign, for statements that show direction separately. */
export function formatAbsolute(paise: Paise): string {
  return inrFormatter.format(Math.abs(paiseToRupees(paise)));
}