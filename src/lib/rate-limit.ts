import "server-only";

/**
 * Rate limiting.
 *
 * Two reasons this exists rather than being left to the perimeter:
 *
 *  1. The OTP endpoint is the one place where guessing is cheap and valuable. Six
 *     digits is a million candidates, so without a cap an attacker gets a
 *     unbounded number of guesses per hour from a single address.
 *  2. Money-moving endpoints (transfer, bill pay, redeem, fund) should be slow to
 *     abuse even if an attacker holds a valid session.
 *
 * Counters live in PostgreSQL rather than process memory so they survive a
 * restart and cover every instance behind a load balancer. A memory map would be
 * simpler but would silently reset on deploy, which is exactly when an attacker
 * would try it.
 *
 * The window is fixed-window rather than sliding: one row per (key, window
 * bucket). That is cheap and good enough for abuse control. It permits a burst of
 * up to 2x the limit across a bucket boundary, which is an acceptable trade for
 * not needing a sliding-window query on every request.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** How many attempts remain in the current window. */
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  /** Human-readable name, used in the limiter's own error messages. */
  name: string;
  /** Attempts allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Limits, separated by what is actually being protected.
 *
 * The asymmetry between the per-number and per-address OTP limits is deliberate
 * and matters in this market. Mobile carriers put thousands of subscribers behind
 * one NAT address, so an address-based cap low enough to stop a distributed
 * attacker would also lock out an entire village sharing a tower. The number is
 * therefore the tight limit, and the address is a coarse ceiling set high enough to
 * survive carrier NAT.
 *
 * Every limit is overridable by environment variable. A test harness that signs in
 * repeatedly is a legitimate caller with different needs, and hardcoding around it
 * would mean either weakening the production defaults or skipping the limiter in
 * tests, which is how it goes untested.
 */
function limit(name: string, fallback: number, windowSeconds: number): RateLimitRule {
  const override = Number(process.env[`RATE_LIMIT_${name.toUpperCase()}`]);
  return {
    name,
    limit: Number.isFinite(override) && override > 0 ? override : fallback,
    windowSeconds,
  };
}

export const RATE_LIMITS = {
  /** OTP send, per number: a person does not need more than this in an hour. */
  otpRequestPhone: limit("otp_request_phone", 6, 3600),
  /**
   * OTP send, per address. High on purpose: see the note above about carrier NAT.
   * Its job is to stop a single host spraying many numbers, not to ration a tower.
   */
  otpRequestAddress: limit("otp_request_address", 200, 3600),
  /** OTP verification, per code. This is the guessable path; see otp.ts. */
  otpVerify: limit("otp_verify", 10, 900),
  /** Sign-up per address: stops bulk account creation from one machine. */
  register: limit("register", 5, 3600),
  /** Money movement per signed-in user: bounds a stolen session. */
  money: limit("money", 10, 3600),
  /** Conversational endpoints, so the ML service cannot be hammered. */
  assistant: limit("assistant", 30, 60),
} satisfies Record<string, RateLimitRule>;

/**
 * Record one attempt and report whether it is allowed.
 *
 * Returns rather than throws, so each caller decides how to surface a refusal:
 * an API route returns 429, a server component renders a message.
 */
export async function consume(
  key: string,
  rule: RateLimitRule,
  now = Date.now()
): Promise<RateLimitResult> {
  const { query, withTransaction } = await import("./db");
  const bucket = Math.floor(now / (rule.windowSeconds * 1000));

  // INSERT ... ON CONFLICT DO UPDATE with a conditional increment, so two
  // simultaneous requests cannot both read the old count and both be admitted.
  // The WHERE clause is what makes it atomic: the row is only bumped while it is
  // still under the limit, and RETURNING tells us whether it was.
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query<{ count: number }>(
      `INSERT INTO rate_limit_counters (bucket_key, window_started_at, count)
            VALUES ($1, to_timestamp($2), 1)
       ON CONFLICT (bucket_key) DO UPDATE
              SET count = rate_limit_counters.count + 1
            WHERE rate_limit_counters.count < $3
        RETURNING count`,
      [key, bucket * rule.windowSeconds, rule.limit]
    );
    return rows[0]?.count ?? 0;
  });

  // A missing row means the WHERE clause blocked the update: the window is full.
  const allowed = result > 0;
  const windowEndMs = (bucket + 1) * rule.windowSeconds * 1000;

  // The counter is only useful for diagnostics; a delete of expired buckets keeps
  // the table from growing without bound.
  if (allowed && result === 1) {
    await query(`DELETE FROM rate_limit_counters WHERE window_started_at < to_timestamp($1)`, [
      Math.floor(now / 1000) - rule.windowSeconds * 2,
    ]).catch(() => {
      // Housekeeping only. A failure here must not fail a legitimate request.
    });
  }

  return {
    allowed,
    remaining: allowed ? Math.max(0, rule.limit - result) : 0,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((windowEndMs - now) / 1000)),
  };
}

/** Best-effort client address, used as a rate-limit key for unauthenticated calls. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}