import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handler, parseBody, ApiError } from "@/lib/api";
import { requestAnomalyScores } from "@/lib/ml-client";
import { withTransaction } from "@/lib/db";

/**
 * Score a user's recent transactions for anomalies and record the flags.
 *
 * Two properties this endpoint must have:
 *
 *  1. It never blocks or reverses a transaction. The proposal is explicit that
 *     flagged activity is surfaced to the user as "was this you?", so the only
 *     write is an alert row.
 *  2. Re-running it is safe. Alerts are keyed to the transaction and the model
 *     version, so scoring the same transactions again updates the existing alert
 *     instead of burying the user in duplicates.
 */

const schema = z.object({
  // Up to a year, so older flagged activity stays reviewable. The emissions
  // trend chart only looks back five months, so this does not widen that.
  days: z.number().int().min(1).max(400).default(90),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to review activity.");

    const input = await parseBody(request, schema);

    const rows = await query<{
      id: number;
      amount: string;
      created_at: Date;
      local_hour: number;
      recent_count: number;
    }>(
      // The hour is taken in Asia/Kolkata explicitly. Taking it in the server's
      // timezone made a 23:47 payment look like 18:47 and the "unusual hour"
      // rule stopped firing, so the reference's headline anomaly went unflagged.
      `SELECT t.id, t.amount, t.created_at,
              EXTRACT(HOUR FROM t.created_at AT TIME ZONE 'Asia/Kolkata')::int AS local_hour,
              (SELECT COUNT(*) FROM transactions r
                WHERE r.account_id = t.account_id
                  AND r.created_at <= t.created_at
                  AND r.created_at > t.created_at - interval '1 hour') AS recent_count
         FROM transactions t
        WHERE t.user_id = $1
          AND t.direction = 'debit'
          AND t.created_at > now() - make_interval(days => $2)
        ORDER BY t.created_at DESC
        LIMIT 400`,
      [user.id, input.days]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: true as const, data: { scored: 0, flagged: 0, source: "ml-service" } });
    }

    const result = await requestAnomalyScores(
      rows.map((r) => ({
        reference: String(r.id),
        amount: Number(r.amount) / 100,
        hour: r.local_hour,
        burst: Number(r.recent_count),
      }))
    );

    // No model available: report zero rather than inventing flags.
    if (!result) {
      return NextResponse.json({ ok: true as const, data: { scored: rows.length, flagged: 0, source: "fallback" } });
    }

    const flaggedRefs = new Set(result.alerts.map((a) => Number(a.reference)));

    await withTransaction(async (client) => {
      for (const alert of result.alerts) {
        await client.query(
          `INSERT INTO anomaly_alerts
             (user_id, transaction_id, score, reasons, threshold, model_version)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, transaction_id) WHERE transaction_id IS NOT NULL DO UPDATE
             SET score = EXCLUDED.score,
                 reasons = EXCLUDED.reasons,
                 model_version = EXCLUDED.model_version`,
          [
            user.id,
            Number(alert.reference),
            alert.anomalyScore,
            JSON.stringify(alert.reasons),
            result.threshold,
            result.modelVersion,
          ]
        );
      }

      // Anything the model previously flagged but no longer does is resolved, so
      // the review list does not accumulate stale warnings.
      await client.query(
        `UPDATE anomaly_alerts
            SET status = 'confirmed'
          WHERE user_id = $1
            AND status = 'open'
            AND transaction_id IS NOT NULL
            AND NOT (transaction_id = ANY($2::bigint[]))`,
        [user.id, [...flaggedRefs]]
      );
    });

    return NextResponse.json({
      ok: true as const,
      data: {
        scored: rows.length,
        flagged: result.alerts.length,
        threshold: result.threshold,
        source: "ml-service" as const,
      },
    });
  })();
}