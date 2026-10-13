import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { postTransaction } from "@/lib/banking/ledger";
import { requireAccount } from "@/lib/auth/guard";
import { refreshTrustScore, loanEligibility } from "@/lib/trust";
import { greenPointsFor } from "@/lib/carbon/factors";
import { recordAudit } from "@/lib/audit";
import { log } from "@/lib/env";

/**
 * Micro-loans.
 *
 * A loan here is a disbursement plus a repayment schedule. The disbursement is
 * the only way money enters an account other than a deposit or a transfer from
 * another user, so it goes through the same posting engine as everything else —
 * which means its creation is atomic with the ledger entry and with the
 * repayment schedule.
 *
 * The amount ceiling and the interest rate are a product policy applied to a
 * trust score. The score comes from the ML service; the policy from here.
 */

const LOAN_TERM_DAYS = 30;

export interface ApplyLoanInput {
  userId: string;
  amount: string | number;
  termMonths: number;
}

export type ApplyLoanResult =
  | { ok: true; loanId: string; outstanding: number }
  | { ok: false; code: string; message: string };

export async function applyForLoan(
  input: ApplyLoanInput,
): Promise<ApplyLoanResult> {
  const amount = new Prisma.Decimal(input.amount);
  const termMonths = Math.max(1, Math.round(input.termMonths));

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { trustScore: true },
  });

  const eligibility = loanEligibility(user.trustScore);
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: "not_eligible",
      message: "Keep using your account regularly and paying bills on time to become eligible.",
    };
  }

  const maxAmount = new Prisma.Decimal(eligibility.maxAmount);
  if (amount.gt(maxAmount)) {
    return {
      ok: false,
      code: "amount_too_high",
      message: `Your current limit is ₹${maxAmount.toFixed(2)}.`,
    };
  }

  // One active loan at a time. The product is deliberately conservative: a
  // second loan while the first is outstanding would not serve a user with no
  // credit history, and would make the repayment schedule meaningless.
  const existing = await prisma.loan.findFirst({
    where: { userId: input.userId, status: { in: ["ACTIVE", "OVERDUE"] } },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false,
      code: "active_loan_exists",
      message: "Repay your current loan before borrowing again.",
    };
  }

  const account = await requireAccount(input.userId);

  // The snapshot is taken before the disbursement, so the score that produced
  // the decision is the one recorded against the loan rather than whatever the
  // score happens to be afterwards.
  const scoring = await refreshTrustScore(input.userId);
  const scoreAtOrigin = scoring?.score ?? user.trustScore;

  const snapshot = await prisma.trustScoreSnapshot.create({
    data: {
      userId: input.userId,
      model: scoring?.source ?? "fallback-rules",
      score: scoreAtOrigin,
      features: scoring ? (scoring as unknown as object) : {},
      contributions: (scoring?.allFactors ?? []) as unknown as object,
      reason: "loan application",
    },
    select: { id: true },
  });

  let loanId: string;

  try {
    // Simple interest on the principal, not compounding. Charged as one figure
    // so the schedule is something a user can actually read.
    const interest = amount.times(eligibility.interestRate);
    const totalDue = amount.plus(interest);
    const outstanding = totalDue;

    loanId = (
      await prisma.$transaction(async (tx) => {
        const loan = await tx.loan.create({
          data: {
            userId: input.userId,
            principal: amount,
            outstanding,
            interestRate: eligibility.interestRate,
            termMonths,
            status: "ACTIVE",
            trustAtOrigin: scoreAtOrigin,
            trustSnapshotId: snapshot.id,
            dueDate: new Date(Date.now() + termMonths * LOAN_TERM_DAYS * 86_400_000),
            disbursedAt: new Date(),
          },
          select: { id: true },
        });

        // One instalment per month of the term. Rounded to paise, with the
        // remainder added to the last instalment rather than dropped, so the
        // instalments always sum to the total due.
        const instalment = totalDue.dividedBy(termMonths).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        let allocated = new Prisma.Decimal(0);
        for (let i = 1; i <= termMonths; i += 1) {
          const portion = i === termMonths ? totalDue.minus(allocated) : instalment;
          allocated = allocated.plus(portion);

          await tx.loanRepayment.create({
            data: {
              loanId: loan.id,
              amount: portion,
              principalPortion: portion
                .dividedBy(termMonths)
                .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
              interestPortion: interest
                .dividedBy(termMonths)
                .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
              status: "PENDING",
              reference: `instal-${Date.now()}-${i}`,
              dueDate: new Date(
                Date.now() + i * LOAN_TERM_DAYS * 86_400_000,
              ),
            },
          });
        }

        return loan.id;
      })
    );
  } catch (error) {
    log("error", "loan creation failed", {
      userId: input.userId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, code: "creation_failed", message: "We could not create that loan." };
  }

  await postTransaction({
    reference: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "LOAN_DISBURSEMENT",
    category: "LOAN",
    amount,
    note: "Micro-loan disbursement",
    toAccountId: account.id,
    toUserId: input.userId,
    co2eKg: 0,
    co2eSource: "static-table",
  });

  await recordAudit({
    userId: input.userId,
    action: "LOAN_APPLIED",
    detail: {
      loanId,
      amount: amount.toString(),
      trustScore: scoreAtOrigin,
      rate: eligibility.interestRate,
      termMonths,
    },
  });

  return {
    ok: true,
    loanId,
    outstanding: Number(
      new Prisma.Decimal(amount).plus(
        amount.times(eligibility.interestRate),
      ).toFixed(2),
    ),
    };
}

export interface RepayLoanResult {
  ok: boolean;
  message: string;
  outstanding?: number;
  status?: string;
}

export async function repayLoan(input: {
  userId: string;
  loanId: string;
  amount: string | number;
  reference: string;
}): Promise<RepayLoanResult> {
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }

  const loan = await prisma.loan.findFirst({
    where: { id: input.loanId, userId: input.userId },
    select: {
      id: true,
      outstanding: true,
      status: true,
      principal: true,
      user: { select: { name: true } },
    },
  });

  if (!loan) {
    return { ok: false, message: "We could not find that loan." };
  }

  if (loan.status !== "ACTIVE" && loan.status !== "OVERDUE") {
    return { ok: false, message: "That loan is not active." };
  }

  if (amount.gt(loan.outstanding)) {
    return {
      ok: false,
      message: `You owe ₹${loan.outstanding.toFixed(2)}. Enter that amount or less.`,
    };
  }

  const account = await requireAccount(input.userId);
  const newOutstanding = loan.outstanding.minus(amount);
  const isFullyRepaid = newOutstanding.lte(0);

  const oldestInstalment = await prisma.loanRepayment.findFirst({
    where: { loanId: loan.id, status: "PENDING" },
    orderBy: { dueDate: "asc" },
    select: { id: true, amount: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      // Mark instalments paid until the repayment is exhausted, so a partial
      // payment settles the oldest instalment first and the schedule stays
      // readable rather than becoming a mystery remainder.
      let remaining = amount;
      let oldest = oldestInstalment;

      while (remaining.gt(0) && oldest) {
        const applies = remaining.gte(oldest.amount)
          ? oldest.amount
          : remaining;

        await tx.loanRepayment.update({
          where: { id: oldest.id },
          data: {
            status: "COMPLETED",
            paidAt: new Date(),
            amount: applies,
          },
        });

        remaining = remaining.minus(applies);

        oldest = await tx.loanRepayment.findFirst({
          where: {
            loanId: loan.id,
            status: "PENDING",
            id: { not: oldest.id },
          },
          orderBy: { dueDate: "asc" },
          select: { id: true, amount: true },
        });
      }

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          outstanding: newOutstanding,
          status: isFullyRepaid ? "REPAID" : loan.status,
          repaidAt: isFullyRepaid ? new Date() : null,
        },
      });
    });
  } catch (error) {
    log("error", "loan repayment transaction failed", {
      loanId: loan.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "We could not record that repayment." };
  }

  // Debit the account. Done outside the schedule transaction so a posting
  // failure (for instance insufficient funds) leaves the schedule untouched and
  // can be reported cleanly.
  await postTransaction({
    reference: input.reference,
    type: "LOAN_REPAYMENT",
    category: "LOAN",
    amount,
    note: "Loan repayment",
    fromAccountId: account.id,
    fromUserId: input.userId,
  });

  await recordAudit({
    userId: input.userId,
    action: "LOAN_REPAYMENT",
    detail: {
      loanId: loan.id,
      amount: amount.toString(),
      outstandingRemaining: newOutstanding.toString(),
      fullyRepaid: isFullyRepaid,
    },
  });

  // Repaying reliably is one of the score's strongest inputs, so recompute now.
  await refreshTrustScore(input.userId, { notifyOnChange: true });

  return {
    ok: true,
    message: isFullyRepaid
      ? "Your loan is fully repaid."
      : `Repayment recorded. You now owe ₹${newOutstanding.toFixed(2)}.`,
    outstanding: Number(newOutstanding),
    status: isFullyRepaid ? "REPAID" : loan.status,
  };
}

export interface LoanView {
  id: string;
  principal: number;
  outstanding: number;
  interestRate: number;
  termMonths: number;
  status: string;
  trustAtOrigin: number;
  dueDate: Date;
  instalments: Array<{
    id: string;
    amount: number;
    dueDate: Date;
    status: string;
    paidAt: Date | null;
  }>;
  nextInstalment: { amount: number; dueDate: Date } | null;
}

export async function listLoans(userId: string): Promise<LoanView[]> {
  const loans = await prisma.loan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { repayments: { orderBy: { dueDate: "asc" } } },
  });

  return loans.map((loan) => {
    const next = loan.repayments.find((r) => r.status === "PENDING");
    return {
      id: loan.id,
      principal: Number(loan.principal),
      outstanding: Number(loan.outstanding),
      interestRate: Number(loan.interestRate),
      termMonths: loan.termMonths,
      status: loan.status,
      trustAtOrigin: loan.trustAtOrigin,
      dueDate: loan.dueDate,
      instalments: loan.repayments.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        dueDate: r.dueDate,
        status: r.status,
        paidAt: r.paidAt,
      })),
      nextInstalment: next
        ? { amount: Number(next.amount), dueDate: next.dueDate }
        : null,
    };
  });
}
