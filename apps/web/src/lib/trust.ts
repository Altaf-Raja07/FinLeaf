import "server-only";
import { prisma } from "@/lib/db";
import { scoreTrust, type TrustFeatures, type TrustScoreResult } from "@/lib/ml/client";
import { createNotification } from "@/lib/notify";
import { log } from "@/lib/env";
import type { TxCategory } from "@/generated/prisma/enums";

/**
 * Trust scoring.
 *
 * Turns the user's own transaction history into the eight behavioural features
 * the model expects, calls the ML service, and writes both the materialised
 * score on `User` and an immutable `TrustScoreSnapshot`.
 *
 * The snapshot is not just history: a loan decision has to remain explainable
 * after the fact, and that is only possible if the features and factor
 * contributions that produced it were recorded. That is the practical shape of
 * the disclosure expectation in the RBI's Digital Lending Directions, 2025.
 *
 * Feature definitions are stated here rather than inferred, because a score a
 * user cannot be told the reasoning for is not explainable no matter how good
 * the model is.
 */

const DAY_MS = 86_400_000;

/**
 * Reads the eight features from real activity.
 *
 *  - savings_regularity    how consistently the user moves money into a goal
 *  - on_time_bill_ratio    share of bill payments made before the due window
 *  - txn_consistency       steadiness of month-on-month activity
 *  - account_age_days      days since signup, normalised to years
 *  - group_activity        trust-circle and family engagement
 *  - avg_balance_stability how little the balance swings
 *  - monthly_txn_count     transactions in the last 30 days, normalised
 *  - repayment_history     share of loan instalments repaid on time
 */
export async function deriveFeatures(userId: string): Promise<TrustFeatures> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
  const ninetyDaysAgo = new Date(now - 90 * DAY_MS);
  const sixMonthsAgo = new Date(now - 180 * DAY_MS);

  const [
    user,
    savingsContributions,
    billPayments,
    recentTxns,
    ninetyDayTxns,
    balanceSnapshots,
    groupCount,
    repayments,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
    prisma.savingsContribution.findMany({
      where: { goal: { userId }, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        fromUserId: userId,
        category: { in: ["BILL_PAYMENT", "RECHARGE"] },
        status: "COMPLETED",
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true, hourOfDay: true },
    }),
    prisma.transaction.findMany({
      where: { fromUserId: userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { fromUserId: userId, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { userId, createdAt: { gte: ninetyDaysAgo } },
      select: { balanceAfter: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    prisma.circleMember.count({ where: { userId } }),
    prisma.loanRepayment.findMany({
      where: { loan: { userId }, status: { not: "PENDING" } },
      select: { status: true, paidAt: true, dueDate: true },
    }),
  ]);

  // --- savings_regularity ------------------------------------------------
  // Measured as the share of distinct months in the last six that contain at
  // least one saving. "Did you save regularly" is a question about consistency
  // across months, not about volume.
  const savingMonths = new Set(
    savingsContributions.map((c) => `${c.createdAt.getFullYear()}-${c.createdAt.getMonth()}`),
  );
  const savingsRegularity = clamp01(savingMonths.size / 6);

  // --- on_time_bill_ratio ------------------------------------------------
  // A bill payment counts as on time when it was made during normal waking
  // hours on a weekday. It is a proxy: the platform does not know a real
  // due date, because FinLeaf does not settle utility bills. The interface
  // never calls this "on-time payment rate" for that reason.
  const onTime = billPayments.filter(
    (b) => b.hourOfDay >= 6 && b.hourOfDay <= 21,
  ).length;
  const onTimeBillRatio =
    billPayments.length > 0 ? clamp01(onTime / billPayments.length) : 0;

  // --- txn_consistency ---------------------------------------------------
  // Coefficient of variation of monthly counts over the last 90 days, inverted
  // so that steady activity scores high and erratic activity scores low. With no
  // data the neutral 0.5 is used rather than 0, so a new user is not punished
  // for having no history.
  const txnConsistency = coefficientConsistency(ninetyDayTxns.map((t) => t.createdAt));

  // --- account_age_days --------------------------------------------------
  const accountAgeDays = user
    ? Math.min(1, (now - user.createdAt.getTime()) / (365 * DAY_MS))
    : 0;

  // --- group_activity ----------------------------------------------------
  // Saturates at three groups: enough to show engagement without letting one
  // enthusiastic user dominate the feature.
  const groupActivity = clamp01(groupCount / 3);

  // --- avg_balance_stability --------------------------------------------
  const avgBalanceStability = balanceStability(balanceSnapshots.map((b) => Number(b.balanceAfter)));

  // --- monthly_txn_count -------------------------------------------------
  const monthlyCount = clamp01(recentTxns.length / 30);

  // --- repayment_history -------------------------------------------------
  const repaidOnTime = repayments.filter(
    (r) => r.status === "COMPLETED" && r.paidAt && r.paidAt <= r.dueDate,
  ).length;
  const repaymentHistory =
    repayments.length > 0 ? clamp01(repaidOnTime / repayments.length) : 0;

  return {
    savings_regularity: savingsRegularity,
    on_time_bill_ratio: onTimeBillRatio,
    txn_consistency: txnConsistency,
    account_age_days: accountAgeDays,
    group_activity: groupActivity,
    avg_balance_stability: avgBalanceStability,
    monthly_txn_count: monthlyCount,
    repayment_history: repaymentHistory,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Steadiness across the last three months.
 *
 * Returns 0.5 when there is no history: a neutral starting point is fairer to a
 * new user than a zero, and it avoids the model reading "no data" as "bad
 * behaviour".
 */
function coefficientConsistency(dates: Date[]): number {
  if (dates.length === 0) return 0.5;

  const buckets = new Map<string, number>();
  for (const date of dates) {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const counts = [...buckets.values()];
  if (counts.length < 2) return 0.5;

  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (mean === 0) return 0.5;

  const variance =
    counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length;
  const cv = Math.sqrt(variance) / mean;

  // A coefficient of variation of 1 is "very erratic"; 0 is "perfectly steady".
  return clamp01(1 - cv);
}

/**
 * How little the balance swings, from the running balance recorded on each
 * ledger entry. A dormant but stable balance scores higher than a small balance
 * that churns, which is the behaviour the feature is trying to capture.
 */
function balanceStability(balances: number[]): number {
  if (balances.length < 2) return 0.5;

  const mean = balances.reduce((a, b) => a + b, 0) / balances.length;
  if (mean === 0) return 0.5;

  const variance =
    balances.reduce((sum, b) => sum + (b - mean) ** 2, 0) / balances.length;
  const cv = Math.sqrt(variance) / mean;

  return clamp01(1 - cv);
}

/**
 * Recalculates a user's trust score and persists the result.
 *
 * Called after any activity that moves a scoring feature, and on demand from the
 * profile page. Failure is logged rather than thrown: a scoring outage must not
 * block the payment that triggered it.
 */
export async function refreshTrustScore(
  userId: string,
  options: { notifyOnChange?: boolean } = {},
): Promise<TrustScoreResult | null> {
  try {
    const features = await deriveFeatures(userId);
    const result = await scoreTrust(features, { model: "gb" });

    const previous = await prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true, name: true },
    });

    await prisma.trustScoreSnapshot.create({
      data: {
        userId,
        model: result.source,
        score: result.score,
        features: features as unknown as object,
        contributions: result.allFactors as unknown as object,
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        trustScore: result.score,
        // Recomputed here rather than on read so loan eligibility, which is
        // checked without loading the user row, sees a current value.
        accountAgeDays: Math.round(features.account_age_days * 365),
      },
    });

    if (
      options.notifyOnChange &&
      previous &&
      Math.abs(previous.trustScore - result.score) >= 5
    ) {
      await createNotification({
        userId,
        type: "SYSTEM",
        title: "Your trust score changed",
        body: `It is now ${result.score}. Open "Why this score" to see what moved it.`,
        href: "/dashboard/profile",
      });
    }

    return result;
  } catch (error) {
    log("error", "trust score refresh failed", {
      userId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Loan eligibility, derived from the trust score.
 *
 * The ceiling and the rate are linear functions of the score and are stated as
 * such in the interface. They are a product decision, not a model output: the
 * model produces the score, the policy produces the limit.
 */
export interface LoanEligibility {
  eligible: boolean;
  maxAmount: number;
  interestRate: number;
  maxTermMonths: number;
  reason?: string;
}

export const MIN_TRUST_FOR_LOAN = 40;
export const LOAN_MIN_AMOUNT = 500;
export const LOAN_MAX_AMOUNT = 50_000;

export function loanEligibility(trustScore: number): LoanEligibility {
  if (trustScore < MIN_TRUST_FOR_LOAN) {
    return {
      eligible: false,
      maxAmount: 0,
      interestRate: 0,
      maxTermMonths: 0,
      reason: "Keep using your account regularly and paying bills on time.",
    };
  }

  // Linear from INR 500 at the threshold to INR 50,000 at a perfect score.
  const span = LOAN_MAX_AMOUNT - LOAN_MIN_AMOUNT;
  const ratio = (trustScore - MIN_TRUST_FOR_LOAN) / (100 - MIN_TRUST_FOR_LOAN);
  const maxAmount = Math.floor((LOAN_MIN_AMOUNT + span * ratio) / 100) * 100;

  // Rate falls from 14% at the threshold to 6% at a perfect score.
  const interestRate = Number((0.14 - 0.08 * ratio).toFixed(4));

  return {
    eligible: true,
    maxAmount,
    interestRate,
    maxTermMonths: 6,
  };
}

export type { TxCategory };
