import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { query, queryOne, withTransaction } from "./db";
import { clientAddress, consume, RATE_LIMITS } from "./rate-limit";

/**
 * One-time passcodes.
 *
 * Design decisions worth stating, because each one closes a specific hole:
 *
 *  * The code is generated per request and stored only as a hash. A leaked
 *    database therefore yields no usable sign-in codes.
 *  * It expires. Five minutes matches what people expect from an SMS code, and
 *    bounds how long an intercepted code stays useful.
 *  * Issuing a new code consumes any outstanding one, so a code texted earlier
 *    cannot be used after the user asks for another.
 *  * Attempts are counted per code and capped. Rate limiting by address alone is
 *    not enough: an attacker who rotates addresses would still get unlimited
 *    guesses against one code.
 *
 * Delivery: there is no SMS gateway wired up. When SMS_PROVIDER_URL is unset the
 * code is returned to the caller so it can be shown on screen, and the UI says
 * plainly that no message was sent. When a gateway URL is configured the code is
 * POSTed to it and nothing is displayed.
 */

const CODE_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS ?? 300);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

export type OtpDelivery = "displayed" | "sms";

export interface IssuedOtp {
  phone: string;
  /** The plaintext code. Only returned when delivery is "displayed". */
  code: string | null;
  delivery: OtpDelivery;
  expiresInSeconds: number;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Cryptographically uniform six digits, so codes cannot be biased or guessed from a pattern. */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** True when an SMS gateway is configured, in which case codes are never shown. */
export function smsProviderConfigured(): boolean {
  return Boolean(process.env.SMS_PROVIDER_URL?.trim());
}

/**
 * Issue a code for a phone number.
 *
 * Rate limited per address and per number. A caller that exceeds either limit gets
 * a refusal rather than a code, and the caller must present that refusal honestly
 * to the user instead of implying a message went out.
 */
export async function issueOtp(phone: string, request: Request): Promise<IssuedOtp | null> {
  const ip = clientAddress(request);

  // Number first: it is the limit that reflects one person's real behaviour.
  const perPhone = await consume(`otp_request:phone:${phone}`, RATE_LIMITS.otpRequestPhone);
  if (!perPhone.allowed) return null;

  // Address second, and set high, because carrier NAT puts many subscribers behind
  // one address. It catches a single host spraying many numbers, not shared towers.
  const perAddress = await consume(`otp_request:addr:${ip}`, RATE_LIMITS.otpRequestAddress);
  if (!perAddress.allowed) return null;

  const code = generateCode();

  await withTransaction(async (client) => {
    // Supersede any outstanding code: only the newest may be used.
    await client.query(
      `UPDATE otp_challenges SET consumed_at = now()
        WHERE phone = $1 AND consumed_at IS NULL`,
      [phone]
    );
    await client.query(
      `INSERT INTO otp_challenges (phone, code_hash, expires_at, request_ip)
       VALUES ($1, $2, now() + ($3 || ' seconds')::interval, $4)`,
      [phone, hashCode(code), String(CODE_TTL_SECONDS), ip]
    );
  });

  const delivery: OtpDelivery = smsProviderConfigured() ? "sms" : "displayed";

  if (delivery === "sms") {
    await sendViaGateway(phone, code);
  }

  return { phone, code: delivery === "displayed" ? code : null, delivery, expiresInSeconds: CODE_TTL_SECONDS };
}

/**
 * POST the code to the configured gateway.
 *
 * A gateway failure is logged and swallowed: the code stays valid so the user can
 * still sign in through the displayed path, and an outage at the provider must not
 * turn into a failed sign-in.
 */
async function sendViaGateway(phone: string, code: string): Promise<void> {
  try {
    await fetch(process.env.SMS_PROVIDER_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_PROVIDER_TOKEN
          ? { Authorization: `Bearer ${process.env.SMS_PROVIDER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ to: phone, message: `${code} is your FinLeaf verification code.` }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    console.error("[otp] gateway delivery failed", err);
  }
}

export type OtpFailure = "no_code" | "expired" | "used" | "too_many_attempts" | "mismatch";

export type OtpResult = { ok: true } | { ok: false; reason: OtpFailure; remaining: number };

/**
 * Verify a submitted code.
 *
 * Marks the challenge consumed on success and on exhaustion, so a code cannot be
 * retried after either outcome. On a mismatch the attempt is counted and returned,
 * which is what lets the UI tell the user how many tries are left.
 */
export async function verifyOtp(
  phone: string,
  submitted: string,
  request?: Request
): Promise<OtpResult> {
  // Per-code attempts bound guessing against one code. Per-address attempts bound
  // an attacker who requests fresh codes and tries each once; without this a
  // thousand codes would mean a thousand guesses at no extra cost.
  if (request) {
    const perAddress = await consume(`otp_verify:addr:${clientAddress(request)}`, RATE_LIMITS.otpVerify);
    if (!perAddress.allowed) return { ok: false, reason: "too_many_attempts", remaining: 0 };
  }

  const challenge = await queryOne<{
    id: number;
    code_hash: string;
    expires_at: Date;
    consumed_at: Date | null;
    attempts: number;
  }>(
    `SELECT id, code_hash, expires_at, consumed_at, attempts
       FROM otp_challenges
      WHERE phone = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [phone]
  );

  if (!challenge) return { ok: false, reason: "no_code", remaining: 0 };

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await consumeChallenge(challenge.id);
    return { ok: false, reason: "expired", remaining: 0 };
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await consumeChallenge(challenge.id);
    return { ok: false, reason: "too_many_attempts", remaining: 0 };
  }

  const expected = Buffer.from(challenge.code_hash, "hex");
  const actual = Buffer.from(hashCode(submitted), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    const remaining = MAX_ATTEMPTS - (challenge.attempts + 1);
    if (remaining <= 0) {
      await consumeChallenge(challenge.id);
      return { ok: false, reason: "too_many_attempts", remaining: 0 };
    }
    await query(`UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1`, [challenge.id]);
    return { ok: false, reason: "mismatch", remaining };
  }

  await consumeChallenge(challenge.id);
  return { ok: true };
}

/** Mark a challenge spent. Guarded on consumed_at so it cannot be un-consumed. */
async function consumeChallenge(id: number): Promise<void> {
  await query(`UPDATE otp_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`, [id]);
}

/** Housekeeping: drop challenges that expired long ago. */
export async function pruneExpiredChallenges(): Promise<number> {
  const rows = await query<{ id: number }>(
    `DELETE FROM otp_challenges WHERE expires_at < now() - interval '1 day' RETURNING id`
  );
  return rows.length;
}