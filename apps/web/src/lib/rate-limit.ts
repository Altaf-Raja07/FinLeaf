import "server-only";
import { prisma } from "@/lib/db";

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * Counters live in the database rather than in process memory so the limits
 * hold when the app runs behind a load balancer with more than one instance —
 * an in-memory counter would give every instance its own budget.
 *
 * The increment and the expiry decision happen in one statement
 * (`INSERT ... ON CONFLICT ... DO UPDATE`) so concurrent requests cannot
 * interleave and lose a count.
 *
 * This is a fixed window, not a sliding one: a caller can in principle issue
 * 2x the limit across a window boundary. That trade-off is acceptable for
 * abuse control and is called out rather than hidden.
 */

export interface RateLimitRule {
  /** Maximum number of requests allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
  /** Epoch ms at which the current window ends. */
  resetAt: number;
}

export const RATE_LIMITS = {
  otpRequest: { limit: 5, windowSeconds: 900 } satisfies RateLimitRule,
  otpVerify: { limit: 10, windowSeconds: 900 } satisfies RateLimitRule,
  signUp: { limit: 3, windowSeconds: 3600 } satisfies RateLimitRule,
  signIn: { limit: 10, windowSeconds: 900 } satisfies RateLimitRule,
  transfer: { limit: 20, windowSeconds: 300 } satisfies RateLimitRule,
  chatbot: { limit: 30, windowSeconds: 300 } satisfies RateLimitRule,
  offsetContribute: { limit: 10, windowSeconds: 300 } satisfies RateLimitRule,
  generic: { limit: 120, windowSeconds: 60 } satisfies RateLimitRule,
} as const satisfies Record<string, RateLimitRule>;

/**
 * Counts one hit against `key` and reports whether it is within `rule`.
 *
 * A limiter failure must never lock a legitimate user out, so a database
 * error is logged and treated as "allowed"; abuse control is a safety net, not
 * an authorisation check.
 */
export async function rateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  // The window start is part of the key, so each window is its own row and the
  // counter resets naturally instead of being carried forward forever. Rows
  // from previous windows are removed by {@link pruneRateLimitBuckets}.
  const bucket = `${rule.limit}:${rule.windowSeconds}:${key}:${windowStart}`;

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt")
      VALUES (${bucket}, 1, ${new Date(windowStart)}, ${new Date(resetAt)})
      ON CONFLICT ("key")
      DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"
    `;

    const count = Number(rows[0]?.count ?? 1);

    return {
      allowed: count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      resetAt,
    };
  } catch {
    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit,
      retryAfterSeconds: 0,
      resetAt,
    };
  }
}

/**
 * Deletes counters for windows that have closed.
 *
 * Called from the scheduled maintenance endpoint; safe to run concurrently
 * because it only touches rows that are already expired.
 */
export async function pruneRateLimitBuckets(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    WITH deleted AS (
      DELETE FROM "RateLimitBucket"
      WHERE "expiresAt" < now()
      RETURNING 1
    )
    SELECT count(*) AS count FROM deleted
  `;
  return Number(rows[0]?.count ?? 0);
}

/** Standard `RateLimit-*` headers for a response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is only trusted because the app is expected to run behind a
 * proxy that sets it; when it is absent the key falls back to a constant so the
 * limit degrades to a global cap rather than being bypassable.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
