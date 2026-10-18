import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { postTransaction } from "@/lib/banking/ledger";
import { requireAccount } from "@/lib/auth/guard";
import { refreshTrustScore } from "@/lib/trust";
import { recordAudit } from "@/lib/audit";
import { log } from "@/lib/env";

/**
 * Micro-savings goals.
 *
 * Moving money into a goal is a real debit: the account balance falls and a
 * ledger entry records the destination. A goal that only tracked a number
 * without touching the account would let the two disagree, and a user's true
 * available balance is the one thing this platform has to be right about.
 */

/** Green points for saving — the platform's only reward for holding money. */
const POINTS_PER_SAVING = 5;

export interface CreateGoalInput {
  userId: string;
  title: string;
  target: string | number;
  dueDate?: Date;
}

export async function createSavingsGoal(
  input: CreateGoalInput,
): Promise<{ ok: true; goalId: string } | { ok: false; message: string }> {
  const target = new Prisma.Decimal(input.target);
  if (target.lte(0)) {
    return { ok: false, message: "Enter a target amount greater than zero." };
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: input.userId,
      title: input.title,
      target,
      dueDate: input.dueDate ?? null,
    },
    select: { id: true },
  });

  return { ok: true, goalId: goal.id };
}

export interface ContributeResult {
  ok: boolean;
  message: string;
  saved?: number;
  reached?: boolean;
}

export async function contributeToGoal(input: {
  userId: string;
  goalId: string;
  amount: string | number;
  reference: string;
}): Promise<ContributeResult> {
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }

  const goal = await prisma.savingsGoal.findFirst({
    where: { id: input.goalId, userId: input.userId, archivedAt: null },
    select: { id: true, target: true, saved: true, title: true },
  });

  if (!goal) {
    return { ok: false, message: "We could not find that goal." };
  }

  const remaining = goal.target.minus(goal.saved);
  if (amount.gt(remaining)) {
    return {
      ok: false,
      message: `This goal needs ${remaining.toFixed(2)} more. Enter that amount or less.`,
    };
  }

  const account = await requireAccount(input.userId);

  try {
    const posted = await postTransaction({
      reference: input.reference,
      type: "SAVINGS_CONTRIBUTION",
      category: "SAVINGS",
      amount,
      note: `Savings: ${goal.title}`,
      fromAccountId: account.id,
      fromUserId: input.userId,
      afterCreate: async (tx, transaction) => {
        // Guarded increment rather than writing `goal.saved + amount` computed
        // from the read above: that read happens outside this transaction, so
        // two simultaneous contributions both saw the same starting total and
        // both wrote the same new total — the account balance and the
        // contribution rows were right, but `saved` under-reported forever.
        await tx.savingsGoal.update({
          where: { id: goal.id },
          data: { saved: { increment: amount } },
        });

        // The ceiling is re-checked against the live row, so two partial
        // contributions cannot together overfund the goal. Throwing here rolls
        // the increment — and the debit — back with everything else.
        const fresh = await tx.savingsGoal.findUniqueOrThrow({
          where: { id: goal.id },
          select: { saved: true, target: true },
        });

        if (fresh.saved.gt(fresh.target)) {
          throw new Error("goal_overfunded");
        }

        await tx.savingsContribution.create({
          data: {
            goalId: goal.id,
            transactionId: transaction.id,
            amount,
            reference: input.reference,
          },
        });

        await tx.user.update({
          where: { id: input.userId },
          data: {
            greenPoints: { increment: POINTS_PER_SAVING },
          },
        });

        await recordAudit({
          userId: input.userId,
          action: "TRANSFER_SENT",
          detail: {
            kind: "savings_contribution",
            goalId: goal.id,
            amount: amount.toString(),
          },
        });
      },
    });

    void posted;
  } catch (error) {
    if (error instanceof Error && error.message === "goal_overfunded") {
      return {
        ok: false,
        message: "That is more than this goal still needs. Enter a smaller amount.",
      };
    }

    log("error", "savings contribution failed", {
      userId: input.userId,
      goalId: goal.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "We could not record that contribution." };
  }

  const updated = await prisma.savingsGoal.findUniqueOrThrow({
    where: { id: goal.id },
    select: { saved: true, target: true },
  });

  const reached = updated.saved.gte(updated.target);

  // Regular saving is the most predictive feature in the trust score, so the
  // score is recomputed immediately rather than on the next login.
  await refreshTrustScore(input.userId);

  return {
    ok: true,
    message: reached
      ? `${goal.title} is fully funded.`
      : `Added ${amount.toFixed(2)} to ${goal.title}.`,
    saved: Number(updated.saved),
    reached,
  };
}

export interface SavingsGoalView {
  id: string;
  title: string;
  target: number;
  saved: number;
  remaining: number;
  percent: number;
  dueDate: Date | null;
  createdAt: Date;
  contributions: Array<{ id: string; amount: number; createdAt: Date }>;
}

export async function listSavingsGoals(userId: string): Promise<SavingsGoalView[]> {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ createdAt: "asc" }],
    include: {
      contributions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return goals.map((goal) => {
    const target = Number(goal.target);
    const saved = Number(goal.saved);
    return {
      id: goal.id,
      title: goal.title,
      target,
      saved,
      remaining: Math.max(0, target - saved),
      percent: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0,
      dueDate: goal.dueDate,
      createdAt: goal.createdAt,
      contributions: goal.contributions.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        createdAt: c.createdAt,
      })),
    };
  });
}

export async function archiveSavingsGoal(
  userId: string,
  goalId: string,
): Promise<{ ok: boolean; message?: string }> {
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true, saved: true },
  });

  if (!goal) return { ok: false, message: "Goal not found." };

  // Withdrawing the saved balance is not offered: the money is already in the
  // savings destination, and archiving the goal without a withdrawal would
  // silently strand it. Instead the goal is archived and the funds stay where
  // they are, which is what a user who just wants to stop tracking a goal
  // means.
  if (goal.saved.gt(0)) {
    return {
      ok: false,
      message: "Withdraw the remaining balance before archiving a goal.",
    };
  }

  await prisma.savingsGoal.update({
    where: { id: goal.id },
    data: { archivedAt: new Date() },
  });

  return { ok: true };
}
