import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { postTransaction, InsufficientFundsError, DuplicateReferenceError } from "@/lib/banking/ledger";
import { generateReference } from "@/lib/crypto";
import { requireAccount } from "@/lib/auth/guard";
import { refreshTrustScore, loanEligibility } from "@/lib/trust";
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

  // Simple interest on the principal, not compounding. Charged as one figure so
  // the schedule is something a user can actually read.
  const interest = amount.times(eligibility.interestRate);
  const totalDue = amount.plus(interest);

  let loanId = "";

  try {
    // The loan row and its schedule are written from `afterCreate`, which runs
    // inside the posting engine's transaction. They used to commit in their own
    // transaction *before* the disbursement, so a posting failure left an ACTIVE
    // loan and a full repayment schedule against money the user never received.
    // Composing them into the posting makes the whole disbursement atomic.
    await postTransaction({
      reference: generateReference("loan"),
      type: "LOAN_DISBURSEMENT",
      category: "LOAN",
      amount,
      note: "Micro-loan disbursement",
      toAccountId: account.id,
      toUserId: input.userId,
      co2eKg: 0,
      co2eSource: "static-table",
      afterCreate: async (tx, transaction) => {
        const loan = await tx.loan.create({
          data: {
            userId: input.userId,
            principal: amount,
            outstanding: totalDue,
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
        const instalment = totalDue
          .dividedBy(termMonths)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

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
              reference: `${transaction.reference}-instal-${i}`,
              dueDate: new Date(
                Date.now() + i * LOAN_TERM_DAYS * 86_400_000,
              ),
            },
          });
        }

        loanId = loan.id;
      },
    });
  } catch (error) {
    log("error", "loan creation failed", {
      userId: input.userId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, code: "creation_failed", message: "We could not create that loan." };
  }

  // `afterCreate` assigns this; it is only empty if the callback did not run,
  // which cannot happen without the post itself having thrown above.
  if (!loanId) {
    return { ok: false, code: "creation_failed", message: "We could not create that loan." };
  }

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

  // The debit and the settlement of the schedule are one transaction. They used
  // to be two, with the schedule committed first and the debit outside any
  // try/catch — so a repayment against an empty balance reduced the debt and
  // stamped the instalments paid, then threw. The user ended up forgiven for
  // money that was never taken. `afterCreate` is the hook that makes the whole
  // repayment atomic; "a posting failure leaves the schedule untouched" is now
  // a property of the rollback rather than of the call order.
  try {
    await postTransaction({
      reference: input.reference,
      type: "LOAN_REPAYMENT",
      category: "LOAN",
      amount,
      note: "Loan repayment",
      fromAccountId: account.id,
      fromUserId: input.userId,
      afterCreate: async (tx) => {
        // Mark instalments paid oldest-first until the repayment is exhausted,
        // so a partial payment settles the earliest one and the schedule stays
        // readable rather than becoming a mystery remainder.
        let remaining = amount;

        for (;;) {
          const oldest = await tx.loanRepayment.findFirst({
            where: { loanId: loan.id, status: "PENDING" },
            orderBy: { dueDate: "asc" },
            select: { id: true, amount: true },
          });

          if (!oldest || remaining.lte(0)) break;

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
        }

        // Guarded decrement rather than a write of `loan.outstanding - amount`
        // computed from the pre-transaction read: two simultaneous repayments
        // would both write the same stale total, and the borrower would keep
        // owing money they had already paid.
        const settled = await tx.loan.updateMany({
          where: { id: loan.id, outstanding: { gte: amount } },
          data: { outstanding: { decrement: amount } },
        });

        if (settled.count === 0) {
          throw new Error("outstanding_changed");
        }

        const current = await tx.loan.findUniqueOrThrow({
          where: { id: loan.id },
          select: { outstanding: true },
        });

        if (current.outstanding.lte(0)) {
          await tx.loan.update({
            where: { id: loan.id },
            data: { status: "REPAID", repaidAt: new Date() },
          });
        }
      },
    });
  } catch (error) {
    log("error", "loan repayment failed", {
      loanId: loan.id,
      reason: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof InsufficientFundsError) {
      return {
        ok: false,
        message: `That is more than your balance. You owe ${error.requested} and have ${error.available}.`,
      };
    }
    if (error instanceof DuplicateReferenceError) {
      return { ok: false, message: "That repayment has already been recorded." };
    }
    return { ok: false, message: "We could not record that repayment." };
  }

  const settled = await prisma.loan.findUniqueOrThrow({
    where: { id: loan.id },
    select: { outstanding: true, status: true },
  });

  const remainingDue = settled.outstanding;
  const fullyRepaid = remainingDue.lte(0);

  await recordAudit({
    userId: input.userId,
    action: "LOAN_REPAYMENT",
    detail: {
      loanId: loan.id,
      amount: amount.toString(),
      outstandingRemaining: remainingDue.toString(),
      fullyRepaid,
    },
  });

  // Repaying reliably is one of the score's strongest inputs, so recompute now.
  await refreshTrustScore(input.userId, { notifyOnChange: true });

  return {
    ok: true,
    message: fullyRepaid
      ? "Your loan is fully repaid."
      : `Repayment recorded. You now owe ${remainingDue.toFixed(2)}.`,
    outstanding: Number(remainingDue),
    status: settled.status,
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
