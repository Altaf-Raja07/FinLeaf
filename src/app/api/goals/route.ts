import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";

/** Create a savings goal. */

const schema = z.object({
  title: z.string().trim().min(2, "Give the goal a name.").max(80),
  targetRupees: z.number().positive("Enter a target above zero.").max(10_000_000),
  weeklyRupees: z.number().min(0).max(1_000_000).optional(),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to create a goal.");

    const input = await parseBody(request, schema);

    const targetPaise = Math.round(input.targetRupees * 100);
    const weeklyPaise = Math.round((input.weeklyRupees ?? 0) * 100);

    const row = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO savings_goals (user_id, title, target_amount, weekly_amount)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [user.id, input.title, targetPaise, weeklyPaise]
      );
      return inserted.rows[0];
    });

    return NextResponse.json({ ok: true as const, data: { id: row.id } });
  })();
}