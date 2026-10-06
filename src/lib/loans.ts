/**
 * Loan eligibility rules.
 *
 * Pure arithmetic with no database or framework dependency, so it can be imported
 * and tested directly. An earlier version lived in `screens.ts` alongside queries
 * that touch the database, which meant the test had to re-implement the formula to
 * import it, and a re-implemented test proves nothing about the shipped rule.
 */

export interface LoanEligibility {
  /** Total the user may borrow, in paise. */
  limitPaise: number;
  instalments: number;
  /** One repayment, in paise. Always a whole rupee. */
  instalmentPaise: number;
}

/** Ceiling on what a maximum trust score can borrow, in rupees. */
export const MAX_LOAN_RUPEES = 50_000;

export const INSTALMENT_COUNT = 6;

/**
 * Loan eligibility from the trust score.
 *
 * Capacity rises with the score because that is the proposal's whole premise:
 * behaviour substitutes for a credit history. Nothing here constitutes credit
 * approval, and the UI says so wherever the number appears.
 *
 * The instalment is rounded to a whole rupee and the limit derived from it, not
 * the other way round. Dividing first and rounding afterwards produced instalments
 * that did not sum to the stated loan (6 x 416,666.67 = 2,500,000.02), so the page
 * quoted a total its own instalments contradicted.
 */
export function eligibleLoanAmount(trustScore: number): LoanEligibility {
  const rawRupees = (trustScore / 100) * MAX_LOAN_RUPEES;
  // Round to the nearest 500 rupees for a figure a lender would actually quote.
  const limitRupees = Math.round(rawRupees / 500) * 500;
  const instalmentRupees = Math.round(limitRupees / INSTALMENT_COUNT);
  return {
    limitPaise: instalmentRupees * INSTALMENT_COUNT * 100,
    instalments: INSTALMENT_COUNT,
    instalmentPaise: instalmentRupees * 100,
  };
}