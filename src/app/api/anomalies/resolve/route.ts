import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";

/**
 * Record the user's answer to a flagged transaction.
 *
 * Scoped by user_id in the UPDATE rather than looked up first, so an alert
 * belonging to someone else cannot be resolved by guessing its id.
 */

const schema = z.object({
  alertId: z.number().int().positive(),
  outcome: z.enum(["confirmed", "disputed"]),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to review activity.");

    const input = await parseBody(request, schema);

    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE anomaly_alerts
            SET status = $1, resolved_at = now()
          WHERE id = $2 AND user_id = $3 AND status = 'open'`,
        [input.outcome, input.alertId, user.id]
      );
      return result.rowCount ?? 0;
    });

    if (updated === 0) {
      throw new ApiError("not_found", "That alert has already been answered.");
    }

    return NextResponse.json({ ok: true as const, data: { alertId: input.alertId, status: input.outcome } });
  })();
}
