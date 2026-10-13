import "server-only";
import { Prisma, TxCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { estimateCo2e } from "@/lib/carbon";
import { scoreAnomaly } from "@/lib/ml/client";
import { postTransaction, type PostedTransaction } from "./ledger";
import { resolveCounterparty } from "./account";
import { PAPERLESS_SHEETS_PER_TRANSACTION } from "@/lib/carbon/factors";
import { recordAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import type { TxCategory as Category } from "@/generated/prisma/enums";

/**
 * Money movement.
 *
 * Transfer is the one path that touches two users' money, so it is the one
 * path that gets the full treatment:
 *
 *   resolve counterparty -> estimate carbon -> score for anomalies ->
 *   post (balances + ledger + transaction) -> flag + reward + notify.
 *
 * The anomaly score is computed *before* posting, but it never blocks the
 * transaction. An unusual payment that is genuinely the user's should still go
 * through; it is flagged and surfaced afterwards for review, which is the
 * intended behaviour and avoids locking a legitimate customer out of their own
 * account.
 */

export class TransferError extends Error {
  constructor(
    readonly code:
      | "recipient_not_found"
      | "self_transfer"
      | "invalid_amount"
      | "account_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "TransferError";
  }
}

export interface TransferInput {
  fromUserId: string;
  fromAccountId: string;
  to: string;
  amount: string | number;
  note?: string;
  category?: Category;
  reference: string;
  locale?: string;
}

export interface TransferResult {
  transaction: PostedTransaction;
  recipientName: string;
  anomalyScore: number;
  flagged: boolean;
  flagId: string | null;
  greenPointsAwarded: number;
  co2eKg: number;
}

/** Features the anomaly detector expects, derived from real account history. */
export interface DerivedAnomalyFeatures {
  amount_log: number;
  hour_of_day: number;
  rapid_repeat: number;
  new_counterparty: number;
  category_rarity: number;
}

export async function transfer(input: TransferInput): Promise<TransferResult> {
  const amount = new Prisma.Decimal(input.amount);

  if (amount.lte(0)) {
    throw new TransferError("invalid_amount", "Enter an amount greater than zero");
  }

  const senderAccount = await prisma.account.findUnique({
    where: { id: input.fromAccountId },
    select: { userId: true },
  });

  const recipient = await resolveCounterparty(input.to);
  if (!recipient) {
    throw new TransferError(
      "recipient_not_found",
      "We could not find that account or phone number",
    );
  }

  if (senderAccount && recipient.userId === senderAccount.userId) {
    throw new TransferError(
      "self_transfer",
      "You cannot send money to your own account",
    );
  }

  const category = input.category ?? "TRANSFER";
  const now = new Date();

  const carbon = await estimateCo2e(category, amount.toNumber(), {
    // The posting transaction must not hold a row lock across an HTTP call.
    preferRemote: false,
    locale: input.locale ?? "en",
  });

  const features = await deriveAnomalyFeatures({
    senderUserId: input.fromUserId,
    amount,
    counterpartyUserId: recipient.userId,
    category,
    at: now,
  });

  const anomaly = await scoreAnomaly(features);

  const posted = await postTransaction({
    reference: input.reference,
    type: "TRANSFER_OUT",
    category,
    amount,
    note: input.note ?? null,
    fromAccountId: input.fromAccountId,
    fromUserId: input.fromUserId,
    toAccountId: recipient.account.id,
    toUserId: recipient.userId,
    co2eKg: carbon.co2eKg,
    co2eSource: carbon.source,
    greenPoints: carbon.greenPoints,
    hourOfDay: now.getHours(),
    anomalyScore: anomaly.anomalyScore,
    afterCreate: async (tx, transaction) => {
      if (anomaly.isAnomalous) {
        await tx.anomalyFlag.create({
          data: {
            userId: input.fromUserId,
            transactionId: transaction.id,
            score: anomaly.anomalyScore,
            reasons: anomaly.reasons,
          },
        });
      }

      if (carbon.greenPoints > 0) {
        await tx.user.update({
          where: { id: input.fromUserId },
          data: { greenPoints: { increment: carbon.greenPoints } },
        });
      }

      // Going paperless is one of the platform's stated benefits, so the
      // counter is advanced on every completed movement.
      await tx.user.update({
        where: { id: input.fromUserId },
        data: {
          paperlessSheets: { increment: PAPERLESS_SHEETS_PER_TRANSACTION },
        },
      });
    },
  });

  const flag = anomaly.isAnomalous
    ? await prisma.anomalyFlag.findUnique({
        where: { transactionId: posted.id },
        select: { id: true },
      })
    : null;

  await Promise.all([
    createNotification({
      userId: recipient.userId,
      type: "TRANSACTION",
      title: "Money received",
      body: `You received a transfer.`,
    }),
    recordAudit({
      userId: input.fromUserId,
      action: "TRANSFER_SENT",
      detail: {
        reference: posted.reference,
        amount: amount.toString(),
        toUserId: recipient.userId,
        flagged: anomaly.isAnomalous,
      },
    }),
  ]);

  return {
    transaction: posted,
    recipientName: recipient.name,
    anomalyScore: anomaly.anomalyScore,
    flagged: anomaly.isAnomalous,
    flagId: flag?.id ?? null,
    greenPointsAwarded: carbon.greenPoints,
    co2eKg: carbon.co2eKg,
  };
}

/**
 * Derives the anomaly model's inputs from real ledger history.
 *
 * The feature scales match those the model was trained on:
 *   - `amount_log`: natural log of the rupee amount (log 500 ~ 6.2, the
 *     training mean);
 *   - `rapid_repeat`: payments to the same counterparty in the last hour,
 *     scaled by 10 so 10+ repeats saturate at 1.0;
 *   - `new_counterparty`: 1 the first time money is sent to someone, else 0;
 *   - `category_rarity`: how rare the category is in this user's own history,
 *     normalised so a category they never use scores near 1.
 */
export async function deriveAnomalyFeatures(input: {
  senderUserId: string;
  amount: Prisma.Decimal;
  counterpartyUserId?: string;
  category: Category;
  at: Date;
}): Promise<DerivedAnomalyFeatures> {
  const { senderUserId, amount, counterpartyUserId, category, at } = input;

  const oneHourAgo = new Date(at.getTime() - 60 * 60 * 1000);

  const [recentToCounterparty, categoryTotals, totalTxns] = await Promise.all([
    counterpartyUserId
      ? prisma.transaction.count({
          where: {
            fromUserId: senderUserId,
            toUserId: counterpartyUserId,
            createdAt: { gte: oneHourAgo },
          },
        })
      : Promise.resolve(0),

    prisma.transaction.groupBy({
      by: ["category"],
      where: { fromUserId: senderUserId },
      _count: { _all: true },
    }),

    prisma.transaction.count({ where: { fromUserId: senderUserId } }),
  ]);

  const newCounterparty = recentToCounterparty === 0 ? 1 : 0;

  const sameCategory = categoryTotals.find((row) => row.category === category);
  const categoryShare =
    totalTxns > 0 && sameCategory ? (sameCategory._count._all ?? 0) / totalTxns : 0;

  // A category the user has never used scores 1.0; one that is half their
  // spending scores 0.5.
  const categoryRarity =
    totalTxns === 0 ? 0.5 : Math.min(1, Math.max(0, 1 - categoryShare));

  return {
    amount_log: Math.log(Math.max(1, amount.toNumber())),
    hour_of_day: at.getHours(),
    rapid_repeat: Math.min(1, recentToCounterparty / 10),
    new_counterparty: newCounterparty,
    category_rarity: categoryRarity,
  };
}

/** Categories a sender may attribute to a transfer for carbon accounting. */
export const TRANSFER_CATEGORIES = [
  "TRANSFER",
  "GROCERIES",
  "FUEL",
  "TRAVEL_PUBLIC",
  "TRAVEL_PRIVATE",
  "DINING",
  "EDUCATION",
  "HEALTHCARE",
  "ELECTRONICS",
  "CLOTHING",
  "OTHER",
] as const satisfies readonly Category[];

export function isTransferCategory(value: string): value is Category {
  return (TRANSFER_CATEGORIES as readonly string[]).includes(value);
}

export const TX_CATEGORY_LABEL: Record<TxCategory, string> = {
  GROCERIES: "Groceries",
  FUEL: "Fuel",
  TRAVEL_PUBLIC: "Public transport",
  TRAVEL_PRIVATE: "Private travel",
  ELECTRICITY: "Electricity",
  DINING: "Dining out",
  EDUCATION: "Education",
  HEALTHCARE: "Healthcare",
  ELECTRONICS: "Electronics",
  CLOTHING: "Clothing",
  HOUSING: "Housing",
  RENT: "Rent",
  SALARY: "Income",
  TRANSFER: "Transfer",
  BILL_PAYMENT: "Bill payment",
  RECHARGE: "Recharge",
  LOAN: "Loan",
  SAVINGS: "Savings",
  GREEN_REWARD: "Green reward",
  OFFSET: "Carbon offset",
  OTHER: "Other",
};
