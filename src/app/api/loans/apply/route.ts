import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";
import { consume, RATE_LIMITS } from "@/lib/rate-limit";
import { getTrustScore } from "@/lib/trust";
import { eligibleLoanAmount } from "@/lib/screens";

/**
 * Record a loan application.
 *
 * The limit is recomputed from the current trust score here rather than trusted
 * from the request, so the client-side cap cannot be bypassed by editing the
 * payload. The score at decision time is stored on the row so a later review can
 * see what the user was actually assessed at.
 */

const schema = z.object({
  principalPaise: z.number().int().positive("Enter an amount above zero.").max(50_000_000),
  purpose: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to apply.");
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

    const score = await getTrustScore(user.id);
    const { limitPaise } = eligibleLoanAmount(score.score);

    if (input.principalPaise > limitPaise) {
      throw new ApiError(
        "validation",
        `Your trust score allows up to ${(limitPaise / 100).toLocaleString("en-IN")} rupees.`
      );
    }

    // Refuse a duplicate open application for the same amount, so a double submit
    // cannot stack two identical requests.
    const existing = await query<{ id: number }>(
      `SELECT id FROM loan_applications
        WHERE user_id = $1 AND principal = $2 AND status IN ('submitted','in_review') LIMIT 1`,
      [user.id, input.principalPaise]
    );
    if (existing.length > 0) {
      throw new ApiError("conflict", "You already have an open application for that amount.");
    }

    const row = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: number; status: string }>(
        `INSERT INTO loan_applications (user_id, principal, status, trust_score_at_decision, note)
         VALUES ($1,$2,'submitted',$3,$4) RETURNING id, status`,
        [user.id, input.principalPaise, score.score, input.purpose ?? null]
      );
      return inserted.rows[0];
    });

    return NextResponse.json({
      ok: true as const,
      data: { id: row.id, status: row.status, limitPaise },
    });
  })();
}
