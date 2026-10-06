import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";
import { ensureWallet, recordDebit } from "@/lib/wallet";
import type { CarbonCategory } from "@/lib/carbon";

/**
 * Simulated bill payment or recharge.
 *
 * Goes through `recordDebit`, so the balance moves atomically and the carbon
 * estimate plus green points are recorded in the same transaction. A due date is
 * accepted for bills, which is what makes on-time payment measurable later.
 */

const schema = z.object({
  category: z.enum(["bills", "recharge"]),
  merchant: z.string().trim().min(2, "Choose a biller.").max(80),
  amountPaise: z.number().int().positive("Enter an amount above zero.").max(10_000_000),
  dueAt: z.string().datetime().optional(),
  idempotencyKey: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to pay a bill.");

    const input = await parseBody(request, schema);

    const result = await withTransaction(async (client) => {
      const duplicate = await client.query(
        `SELECT 1 FROM transactions WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [user.id, input.idempotencyKey]
      );
      if ((duplicate.rowCount ?? 0) > 0) return { duplicate: true };

      const walletId = await ensureWallet(client, user.id);
      const debit = await recordDebit(client, {
        userId: user.id,
        accountId: walletId,
        amountPaise: input.amountPaise,
        category: input.category as CarbonCategory,
        merchant: input.merchant,
        idempotencyKey: input.idempotencyKey,
      });

      // Record the simulated due date against the transaction we just wrote, so
      // the trust score's on-time factor has something real to measure.
      if (input.dueAt) {
        await client.query(
          `UPDATE transactions SET due_at = $1 WHERE id = $2`,
          [input.dueAt, debit.transactionId]
        );
      }

      return {
        duplicate: false,
        transactionId: debit.transactionId,
        co2eKg: debit.co2eKg,
        points: debit.points,
        balanceAfter: debit.balanceAfter,
      };
    });

    return NextResponse.json({ ok: true as const, data: result });
  })();
}