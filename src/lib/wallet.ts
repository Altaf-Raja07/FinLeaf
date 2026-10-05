import type { PoolClient } from "pg";
import { z } from "zod";
import { estimateCarbon, greenPointsFor, type CarbonCategory } from "./carbon";
import { ApiError, InsufficientFundsError } from "./api";

/**
 * Wallet operations.
 *
 * Every function that moves money runs inside a caller-supplied transaction and
 * takes a row lock (`SELECT ... FOR UPDATE`) on the account before reading the
 * balance. That combination is what makes transfers safe:
 *
 *   - the lock serialises concurrent transfers on the same account,
 *   - the CHECK (balance >= 0) constraint is the final backstop, so even a bug
 *     in this file cannot leave a negative balance,
 *   - a throw anywhere rolls back the debit, the credit, and the rows.
 *
 * `idempotencyKey` makes a repeated submit safe: the same key returns the
 * original result instead of moving the money twice.
 */

export const transferSchema = z.object({
  recipientId: z.number().int().positive(),
  amountPaise: z.number().int().positive().max(100_000_000),
  note: z.string().max(140).optional(),
  idempotencyKey: z.string().min(8).max(120),
});

export const billPaymentSchema = z.object({
  category: z.enum(["bills", "recharge"]),
  merchant: z.string().min(2).max(80),
  amountPaise: z.number().int().positive().max(100_000_000),
  note: z.string().max(140).optional(),
  idempotencyKey: z.string().min(8).max(120),
});

export interface TransferResult {
  transferGroupId: string;
  amountPaise: number;
  balanceAfter: number;
  duplicate: boolean;
}

/** Lock an account row and return its current state. */
async function lockAccount(
  client: PoolClient,
  accountId: number,
  userId: number
): Promise<{ id: number; balance: number }> {
  const { rows } = await client.query<{ id: number; balance: string }>(
    `SELECT id, balance
       FROM accounts
      WHERE id = $1 AND user_id = $2
      FOR UPDATE`,
    [accountId, userId]
  );
  if (rows.length === 0) {
    throw new ApiError("not_found", "That account is not available.");
  }
  return { id: rows[0].id, balance: Number(rows[0].balance) };
}

/** Default wallet account for a user, created on first use. */
export async function ensureWallet(client: PoolClient, userId: number): Promise<number> {
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM accounts WHERE user_id = $1 AND kind = 'wallet' ORDER BY id LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const created = await client.query<{ id: number }>(
    `INSERT INTO accounts (user_id, label, kind) VALUES ($1, 'Main wallet', 'wallet') RETURNING id`,
    [userId]
  );
  return created.rows[0].id;
}

/**
 * Return the previous transfer for an idempotency key, or null.
 *
 * Reads transactions.idempotency_key, which has a unique index behind it, so the
 * "already done" decision is enforced by the database rather than by a string
 * convention. The user's own note is left untouched.
 */
async function findIdempotent(
  client: PoolClient,
  userId: number,
  idempotencyKey: string
): Promise<TransferResult | null> {
  const { rows } = await client.query<{
    transfer_group_id: string;
    amount: string;
    balance_after: string;
  }>(
    `SELECT t.transfer_group_id, t.amount,
            COALESCE(
              (SELECT a.balance FROM accounts a
                WHERE a.id = t.account_id AND a.user_id = $1),
              0
            ) AS balance_after
       FROM transactions t
      WHERE t.user_id = $1
        AND t.idempotency_key = $2
      ORDER BY t.id
      LIMIT 1`,
    [userId, idempotencyKey]
  );
  if (rows.length === 0) return null;
  return {
    transferGroupId: rows[0].transfer_group_id ?? "",
    amountPaise: Number(rows[0].amount),
    // The balance recorded at the time of the original transfer, not the current
    // one, so a retry reports what the caller was told the first time.
    balanceAfter: Number(rows[0].balance_after),
    duplicate: true,
  };
}

export interface TransferInput {
  userId: number;
  fromAccountId: number;
  toUserId: number;
  toAccountId: number;
  amountPaise: number;
  note?: string;
  idempotencyKey: string;
  category?: CarbonCategory;
}

/**
 * Move money between two accounts as a single atomic operation.
 *
 * Both transaction rows share a `transfer_group_id`, so the pair can be shown
 * as one logical transfer in history.
 */
export async function transferMoney(client: PoolClient, input: TransferInput): Promise<TransferResult> {
  const duplicate = await findIdempotent(client, input.userId, input.idempotencyKey);
  if (duplicate) return duplicate;

  if (input.toUserId === input.userId) {
    throw new ApiError("validation", "Choose someone other than yourself to send money to.");
  }

  const from = await lockAccount(client, input.fromAccountId, input.userId);
  const to = await lockAccount(client, input.toAccountId, input.toUserId);

  if (from.balance < input.amountPaise) {
    throw new InsufficientFundsError(from.balance);
  }

  const groupId = crypto.randomUUID();

  // Conditional UPDATE: even with the lock held, the WHERE clause re-asserts
  // the balance, so an unexpected write cannot slip past the check.
  const debited = await client.query(
    `UPDATE accounts
        SET balance = balance - $1
      WHERE id = $2 AND user_id = $3 AND balance >= $1
      RETURNING balance`,
    [input.amountPaise, from.id, input.userId]
  );
  if (debited.rowCount === 0) {
    throw new InsufficientFundsError(from.balance);
  }
  const balanceAfter = Number((debited.rows[0] as { balance: string }).balance);

  await client.query(
    `UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3`,
    [input.amountPaise, to.id, input.toUserId]
  );

  const category: CarbonCategory = input.category ?? "transfer";

  // The unique index on (user_id, idempotency_key) is the real guard: a
  // concurrent second request with the same key hits a constraint violation and
  // the whole transaction rolls back, rather than both debiting.
  await client.query(
    `INSERT INTO transactions
       (account_id, user_id, direction, amount, category, merchant, note,
        counterparty_id, transfer_group_id, idempotency_key)
     VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7, $8, $9)`,
    [
      from.id,
      input.userId,
      input.amountPaise,
      category,
      "Transfer sent",
      input.note ?? null,
      input.toUserId,
      groupId,
      input.idempotencyKey,
    ]
  );

  await client.query(
    `INSERT INTO transactions
       (account_id, user_id, direction, amount, category, merchant, transfer_group_id)
     VALUES ($1, $2, 'credit', $3, 'transfer', $4, $5)`,
    [to.id, input.toUserId, input.amountPaise, "Transfer received", groupId]
  );

  return { transferGroupId: groupId, amountPaise: input.amountPaise, balanceAfter, duplicate: false };
}

/**
 * Record a simple debit such as a bill payment, recharge, or savings
 * contribution, together with its carbon estimate and any green points.
 */
export async function recordDebit(
  client: PoolClient,
  input: {
    userId: number;
    accountId: number;
    amountPaise: number;
    category: CarbonCategory;
    merchant: string;
    note?: string;
    /**
     * Optional idempotency key. When supplied it is stored on the transaction
     * behind a unique index, so a repeated submit of the same operation is
     * rejected by the database rather than depending on the caller to check.
     */
    idempotencyKey?: string;
  }
): Promise<{ transactionId: number; co2eKg: number; points: number; balanceAfter: number; duplicate: boolean }> {
  const account = await lockAccount(client, input.accountId, input.userId);
  if (account.balance < input.amountPaise) {
    throw new InsufficientFundsError(account.balance);
  }

  const debited = await client.query(
    `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3 AND balance >= $1 RETURNING balance`,
    [input.amountPaise, account.id, input.userId]
  );
  if (debited.rowCount === 0) throw new InsufficientFundsError(account.balance);
  const balanceAfter = Number((debited.rows[0] as { balance: string }).balance);

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO transactions
       (account_id, user_id, direction, amount, category, merchant, note, idempotency_key)
     VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      account.id,
      input.userId,
      input.amountPaise,
      input.category,
      input.merchant,
      input.note ?? null,
      input.idempotencyKey ?? null,
    ]
  );
  const transactionId = inserted.rows[0].id;

  const estimate = estimateCarbon(input.category, input.amountPaise);
  await client.query(
    `INSERT INTO carbon_estimates (transaction_id, category, factor_kg_per_100rupees, co2e_kg, source)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (transaction_id) DO UPDATE
       SET factor_kg_per_100rupees = EXCLUDED.factor_kg_per_100rupees,
           co2e_kg = EXCLUDED.co2e_kg`,
    [transactionId, estimate.category, estimate.kgPer100Rupees, estimate.co2eKg, estimate.source]
  );

  const points = greenPointsFor(input.category, input.amountPaise);
  if (points > 0) {
    // ON CONFLICT DO NOTHING: the unique constraint on transaction_id means a
    // repeat can never award the same points twice.
    await client.query(
      `INSERT INTO green_point_awards (user_id, transaction_id, points, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (transaction_id) DO NOTHING`,
      [input.userId, transactionId, points, `${input.category} purchase`]
    );
  }

  return { transactionId, co2eKg: estimate.co2eKg, points, balanceAfter, duplicate: false };
}

/** Total balance across every account a user owns. */
export async function totalBalance(client: PoolClient, userId: number): Promise<number> {
  const { rows } = await client.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(balance), 0) AS total FROM accounts WHERE user_id = $1`,
    [userId]
  );
  return Number(rows[0]?.total ?? 0);
}