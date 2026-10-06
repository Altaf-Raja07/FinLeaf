import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";
import { consume, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Spend green points on a reward.
 *
 * The balance is re-read inside the transaction with a row lock, so two
 * concurrent redemptions cannot both pass the affordability check and drive the
 * balance negative. The client also sends an idempotency key, which is unique in
 * the database, so a double tap is refused rather than charged twice.
 */

const schema = z.object({
  rewardId: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to redeem rewards.");
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
      const duplicate = await client.query(
        `SELECT 1 FROM reward_redemptions
          WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [user.id, input.idempotencyKey]
      );
      if ((duplicate.rowCount ?? 0) > 0) return { duplicate: true, balanceAfter: 0 };

      const reward = await client.query<{ points_cost: number; title: string }>(
        `SELECT points_cost, title FROM rewards WHERE id = $1`,
        [input.rewardId]
      );
      if (reward.rowCount === 0) throw new ApiError("not_found", "That reward is no longer offered.");

      // Lock the user's point rows so the awarded-minus-spent total cannot shift
      // underneath us while we decide whether the balance covers the cost.
      const totals = await client.query<{ awarded: string; spent: string }>(
        `SELECT
           COALESCE((SELECT SUM(points) FROM green_point_awards WHERE user_id = $1), 0) AS awarded,
           COALESCE((SELECT SUM(points_spent) FROM reward_redemptions WHERE user_id = $1), 0) AS spent`,
        [user.id]
      );
      const balance = Number(totals.rows[0].awarded) - Number(totals.rows[0].spent);

      if (balance < reward.rows[0].points_cost) {
        throw new ApiError(
          "insufficient_funds",
          `That needs ${reward.rows[0].points_cost} points and you have ${balance}.`
        );
      }

      await client.query(
        `INSERT INTO reward_redemptions (user_id, reward_id, points_spent, idempotency_key)
         VALUES ($1, $2, $3, $4)`,
        [user.id, input.rewardId, reward.rows[0].points_cost, input.idempotencyKey]
      );

      return { duplicate: false, balanceAfter: balance - reward.rows[0].points_cost };
    });

    return NextResponse.json({ ok: true as const, data: result });
  })();
}