import "server-only";
import { Prisma, LedgerDirection, TxStatus, type TxCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { generateReference } from "@/lib/crypto";

/**
 * The posting engine.
 *
 * Every movement of money in FinLeaf goes through {@link postTransaction}. It
 * writes, in a single database transaction:
 *
 *   1. the business-level `Transaction` row,
 *   2. the materialised `Account.balance` updates,
 *   3. the immutable `LedgerEntry` rows (one DEBIT, one CREDIT) carrying the
 *      resulting balance for reconciliation.
 *
 * ## Why balances cannot go negative
 *
 * The debit is a single guarded `UPDATE ... WHERE balance >= amount`. Postgres
 * takes a row lock for the duration of that statement and re-evaluates the
 * `WHERE` clause against the committed row, so two concurrent debits that would
 * together overdraw an account cannot both succeed: the second one matches zero
 * rows and the caller is told the funds are insufficient. Doing this in
 * application code (read balance, compare, write) would be a classic
 * check-then-act race.
 *
 * ## Idempotency
 *
 * `reference` is unique. A retried request carrying a reference that has
 * already been posted returns the original transaction instead of moving money
 * a second time, which is what makes client retries safe.
 */

export class InsufficientFundsError extends Error {
  constructor(
    readonly available: string,
    readonly requested: string,
  ) {
    super("Insufficient funds");
    this.name = "InsufficientFundsError";
  }
}

export class DuplicateReferenceError extends Error {
  constructor(readonly reference: string) {
    super(`Reference ${reference} has already been used`);
    this.name = "DuplicateReferenceError";
  }
}

export class AccountUnavailableError extends Error {
  constructor() {
    super("Account is not available for this transaction");
    this.name = "AccountUnavailableError";
  }
}

export interface PostTransactionInput {
  type:
    | "DEPOSIT"
    | "WITHDRAW"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "BILL_PAYMENT"
    | "RECHARGE"
    | "LOAN_DISBURSEMENT"
    | "LOAN_REPAYMENT"
    | "SAVINGS_CONTRIBUTION"
    | "GREEN_OFFSET";
  category: TxCategory;
  amount: Prisma.Decimal | string | number;
  note?: string | null;
  billerId?: string | null;

  /** Exactly one of these must be set for money to leave an account. */
  fromAccountId?: string | null;
  fromUserId?: string | null;

  /** Exactly one of these must be set for money to arrive in an account. */
  toAccountId?: string | null;
  toUserId?: string | null;

  /** Estimated kg CO2e and which factor source produced it. */
  co2eKg?: Prisma.Decimal | string | number;
  co2eSource?: string;
  greenPoints?: number;
  hourOfDay?: number;
  anomalyScore?: number;

  /** Defaults to a generated reference; pass one to make the call idempotent. */
  reference?: string;

  /**
   * Runs before commit — used to mutate the user's green points or write the
   * domain row that accompanies the movement (a savings contribution, an
   * offset, a loan repayment). Receives the same transaction client, so its
   * writes commit or roll back with the posting.
   */
  afterCreate?: (tx: Prisma.TransactionClient, transaction: PostedTransaction) => Promise<void>;
}

export interface PostedTransaction {
  id: string;
  reference: string;
  amount: Prisma.Decimal;
  status: TxStatus;
  fromAccountId: string | null;
  toAccountId: string | null;
  createdAt: Date;
}

const dec = (value: Prisma.Decimal | string | number): Prisma.Decimal =>
  typeof value === "object" ? value : new Prisma.Decimal(value);

/** Guards against a caller posting a non-positive amount. */
function assertPositive(amount: Prisma.Decimal): void {
  if (amount.lte(0)) {
    throw new Error("Transaction amount must be greater than zero");
  }
}

export async function postTransaction(
  input: PostTransactionInput,
): Promise<PostedTransaction> {
  const amount = dec(input.amount);
  assertPositive(amount);

  const co2e = dec(input.co2eKg ?? 0);
  const reference = input.reference ?? generateReference("txn");

  if (!input.fromAccountId && !input.toAccountId) {
    throw new Error("A transaction must debit or credit an account");
  }

  return prisma.$transaction(
    async (tx) => {
      // Replay guard. Checked inside the transaction so a concurrent request
      // carrying the same reference is caught by the unique index below rather
      // than by this read.
      const existing = await tx.transaction.findUnique({
        where: { reference },
      });
      if (existing) {
        return {
          id: existing.id,
          reference: existing.reference,
          amount: existing.amount,
          status: existing.status,
          fromAccountId: existing.fromAccountId,
          toAccountId: existing.toAccountId,
          createdAt: existing.createdAt,
        };
      }

      // 1. Move the balances. The debit is guarded so an account can never be
      //    overdrawn, and each statement returns the resulting balance so the
      //    ledger entry can record `balanceAfter` without a second read.
      let debitBalanceAfter: Prisma.Decimal | null = null;
      let creditBalanceAfter: Prisma.Decimal | null = null;

      if (input.fromAccountId) {
        const rows = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>(Prisma.sql`
          UPDATE "Account"
             SET "balance" = "balance" - ${amount}, "updatedAt" = now()
           WHERE "id" = ${input.fromAccountId}
             AND "status" = 'ACTIVE'
             AND "balance" >= ${amount}
          RETURNING "balance"
        `);

        if (rows.length === 0) {
          const current = await tx.account.findUnique({
            where: { id: input.fromAccountId },
            select: { balance: true, status: true },
          });

          if (!current || current.status !== "ACTIVE") {
            throw new AccountUnavailableError();
          }
          throw new InsufficientFundsError(
            current.balance.toString(),
            amount.toString(),
          );
        }

        debitBalanceAfter = rows[0].balance;
      }

      if (input.toAccountId) {
        const rows = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>(Prisma.sql`
          UPDATE "Account"
             SET "balance" = "balance" + ${amount}, "updatedAt" = now()
           WHERE "id" = ${input.toAccountId}
             AND "status" = 'ACTIVE'
          RETURNING "balance"
        `);

        if (rows.length === 0) {
          throw new AccountUnavailableError();
        }

        creditBalanceAfter = rows[0].balance;
      }

      // 2. The business-level record.
      const transaction = await tx.transaction.create({
        data: {
          reference,
          type: input.type,
          category: input.category,
          status: TxStatus.COMPLETED,
          amount,
          note: input.note ?? null,
          billerId: input.billerId ?? null,
          fromAccountId: input.fromAccountId ?? null,
          fromUserId: input.fromUserId ?? null,
          toAccountId: input.toAccountId ?? null,
          toUserId: input.toUserId ?? null,
          co2eKg: co2e,
          co2eSource: input.co2eSource ?? "static-table",
          greenPoints: input.greenPoints ?? 0,
          hourOfDay: input.hourOfDay ?? new Date().getHours(),
          anomalyScore: input.anomalyScore ?? 0,
          settledAt: new Date(),
        },
      });

      // 3. The immutable double-entry trail.
      if (input.fromAccountId && debitBalanceAfter) {
        await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId: input.fromAccountId,
            userId: input.fromUserId ?? null,
            direction: LedgerDirection.DEBIT,
            amount,
            balanceAfter: debitBalanceAfter,
          },
        });
      }

      if (input.toAccountId && creditBalanceAfter) {
        await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId: input.toAccountId,
            userId: input.toUserId ?? null,
            direction: LedgerDirection.CREDIT,
            amount,
            balanceAfter: creditBalanceAfter,
          },
        });
      }

      if (input.afterCreate) {
        await input.afterCreate(tx, {
          id: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount,
          status: transaction.status,
          fromAccountId: transaction.fromAccountId,
          toAccountId: transaction.toAccountId,
          createdAt: transaction.createdAt,
        });
      }

      return {
        id: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount,
        status: transaction.status,
        fromAccountId: transaction.fromAccountId,
        toAccountId: transaction.toAccountId,
        createdAt: transaction.createdAt,
      };
    },
    {
      // ReadCommitted is sufficient because correctness rests on the atomic
      // guarded UPDATE and the unique index on `reference`, not on read
      // isolation. Serializable would only add retry handling for overlaps that
      // the row locks already prevent.
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10_000,
    },
  );
}

/**
 * Convenience wrapper for one-sided movements (cash deposits, withdrawals).
 * Keeps the call sites from repeating the null-vs-id dance.
 */
export async function postOneSided(
  input: Omit<PostTransactionInput, "fromAccountId" | "toAccountId"> & {
    direction: "in" | "out";
    accountId: string;
  },
): Promise<PostedTransaction> {
  const { direction, accountId, ...rest } = input;
  return postTransaction({
    ...rest,
    fromAccountId: direction === "out" ? accountId : null,
    toAccountId: direction === "in" ? accountId : null,
  });
}
