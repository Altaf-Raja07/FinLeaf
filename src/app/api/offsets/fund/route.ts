import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";
import { consume, RATE_LIMITS } from "@/lib/rate-limit";

/** Fund a carbon offset project with green points. */

const schema = z.object({
  projectId: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to fund a project.");
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
        `SELECT 1 FROM offset_fundings
          WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [user.id, input.idempotencyKey]
      );
      if ((duplicate.rowCount ?? 0) > 0) return { duplicate: true, balanceAfter: 0 };

      const project = await client.query<{ points_cost: number; title: string }>(
        `SELECT points_cost, title FROM offset_projects WHERE id = $1`,
        [input.projectId]
      );
      if (project.rowCount === 0) throw new ApiError("not_found", "That project is no longer listed.");

      const totals = await client.query<{ awarded: string; spent: string }>(
        `SELECT
           COALESCE((SELECT SUM(points) FROM green_point_awards WHERE user_id = $1), 0) AS awarded,
           COALESCE((SELECT SUM(points_spent) FROM reward_redemptions WHERE user_id = $1), 0) AS spent`,
        [user.id]
      );
      const balance = Number(totals.rows[0].awarded) - Number(totals.rows[0].spent);

      if (balance < project.rows[0].points_cost) {
        throw new ApiError(
          "insufficient_funds",
          `That project needs ${project.rows[0].points_cost} points and you have ${balance}.`
        );
      }

      // Recorded against the rewards ledger as well, so spending points on an
      // offset reduces the balance the same way a reward does. Without this the
      // points would be counted twice: once here and once in the rewards total.
      await client.query(
        `INSERT INTO offset_fundings (user_id, project_id, points_spent, idempotency_key)
         VALUES ($1, $2, $3, $4)`,
        [user.id, input.projectId, project.rows[0].points_cost, input.idempotencyKey]
      );

      const reward = await client.query<{ id: number }>(
        `SELECT id FROM rewards WHERE code = 'tree-sapling'`
      );
      if ((reward.rowCount ?? 0) > 0) {
        await client.query(
          `INSERT INTO reward_redemptions (user_id, reward_id, points_spent, idempotency_key)
           VALUES ($1, $2, $3, $4)`,
          [user.id, reward.rows[0].id, project.rows[0].points_cost, `${input.idempotencyKey}-offset`]
        );
      }

      return { duplicate: false, balanceAfter: balance - project.rows[0].points_cost };
    });

    return NextResponse.json({ ok: true as const, data: result });
  })();
}