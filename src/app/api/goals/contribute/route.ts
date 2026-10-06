import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";
import { consume, RATE_LIMITS } from "@/lib/rate-limit";
import { ensureWallet, recordDebit } from "@/lib/wallet";

/**
 * Add money to a savings goal.
 *
 * Moves the amount out of the wallet and records it as a goal contribution. Both
 * happen in one transaction, and the goal's saved_amount is recomputed from its
 * contributions rather than incremented, so the progress bar can never drift from
 * the contribution list.
 */

const schema = z.object({
  goalId: z.number().int().positive(),
  amountPaise: z.number().int().positive("Enter an amount above zero.").max(10_000_000),
  idempotencyKey: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to add savings.");
    // Throttle per signed-in user. A stolen session is the realistic abuse
    // case, so this bounds how fast money can leave even with valid
    // credentials.
    const limit = await consume(`money:user:${user.id}`, RATE_LIMITS.money);
    if (!limit.allowed) {
      throw new ApiError(
        "rate_limited",
        "Too many requests. Wait a few minutes before trying again."
      );
    }
    const input = await parseBody(request, schema);

    const result = await withTransaction(async (client) => {
      const goal = await client.query<{ id: number; title: string }>(
        `SELECT id, title FROM savings_goals WHERE id = $1 AND user_id = $2`,
        [input.goalId, user.id]
      );
      if (goal.rowCount === 0) throw new ApiError("not_found", "That goal no longer exists.");

      // Refuse a repeat of the same tap before any money moves.
      const seen = await client.query<{ exists: number }>(
        `SELECT 1 AS exists
          FROM transactions
         WHERE user_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [user.id, input.idempotencyKey]
      );
      if ((seen.rowCount ?? 0) > 0) {
        return { duplicate: true, saved: 0, balanceAfter: 0 };
      }

      const walletId = await ensureWallet(client, user.id);
      // Money leaves the wallet and is recorded as a transfer so it appears in
      // history. Category is not one of the carbon categories, so this correctly
      // contributes no emissions: moving your own money is not a purchase.
      const debit = await recordDebit(client, {
        userId: user.id,
        accountId: walletId,
        amountPaise: input.amountPaise,
        category: "transfer",
        merchant: `Saved: ${goal.rows[0].title}`,
        // Stored behind a unique index, so a concurrent duplicate tap rolls the
        // whole thing back instead of recording two contributions.
        idempotencyKey: input.idempotencyKey,
      });

      await client.query(
        `INSERT INTO goal_contributions (goal_id, amount) VALUES ($1, $2)`,
        [input.goalId, input.amountPaise]
      );

      // Recompute from the contributions rather than adding, so the stored total
      // always equals the sum of the rows that justify it.
      await client.query(
        `UPDATE savings_goals sg
            SET saved_amount = COALESCE((
                  SELECT SUM(gc.amount) FROM goal_contributions gc WHERE gc.goal_id = sg.id
                ), 0)
          WHERE sg.id = $1`,
        [input.goalId]
      );

      const saved = await client.query<{ saved_amount: string }>(
        `SELECT saved_amount FROM savings_goals WHERE id = $1`,
        [input.goalId]
      );

      return {
        duplicate: false,
        saved: Number(saved.rows[0].saved_amount),
        balanceAfter: debit.balanceAfter,
      };
    });

    return NextResponse.json({ ok: true as const, data: result });
  })();
}