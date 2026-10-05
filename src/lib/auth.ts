import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { queryOne, withTransaction } from "./db";

/**
 * Authentication for the simulated prototype.
 *
 * Decisions, and why:
 *
 *  * Passwords use scrypt from node:crypto. scrypt is deliberately expensive and
 *    memory-hard, so a stolen hash is expensive to attack. This avoids adding a
 *    native dependency for a hashing library we do not need.
 *  * Each user carries their own scrypt parameters, so the cost can be raised
 *    later and only new hashes pay the higher price.
 *  * Session tokens are random 32-byte values. Only the SHA-256 hash is stored,
 *    so read access to the database does not yield usable sessions.
 *  * The cookie is httpOnly + SameSite=Lax, so it is not readable from
 *    JavaScript and is not sent on cross-site POSTs.
 *
 * This is a student prototype. It has no rate limiting, no MFA, no CSRF tokens
 * beyond SameSite, and no email verification. Those are deliberate omissions,
 * not oversights, and are recorded in the README.
 */

const SCRYPT_COST = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = "finleaf_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 7);

export function hashPassword(password: string): { hash: string; salt: string; params: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_COST.keylen, {
    N: SCRYPT_COST.N,
    r: SCRYPT_COST.r,
    p: SCRYPT_COST.p,
  });
  return { hash: hash.toString("hex"), salt, params: JSON.stringify(SCRYPT_COST) };
}

/** Constant-time comparison, so a wrong password cannot be found byte by byte. */
export function verifyPassword(password: string, hash: string, salt: string, paramsJson: string): boolean {
  let cost = SCRYPT_COST;
  try {
    const parsed = JSON.parse(paramsJson) as { N: number; r: number; p: number; keylen: number };
    cost = parsed;
  } catch {
    // Fall back to current defaults if the stored params are unreadable.
  }
  const candidate = scryptSync(password, salt, cost.keylen, { N: cost.N, r: cost.r, p: cost.p });
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: number;
  phone: string;
  fullName: string;
  language: string;
}

/** Create a session row and return the raw token to place in the cookie. */
export async function createSession(userId: number, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomBytes(9).toString("base64url"), userId, hashToken(token), expiresAt, userAgent ?? null]
    );
  });
  return token;
}

/** Resolve the signed-in user from the request cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<SessionUser & { expires_at: Date }>(
    `SELECT u.id, u.phone, u.full_name AS "fullName", u.language, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1`,
    [hashToken(token)]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await withTransaction(async (client) => {
      await client.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
    });
    return null;
  }
  return { id: row.id, phone: row.phone, fullName: row.fullName, language: row.language };
}

/**
 * Like getSessionUser, but throws instead of returning null.
 *
 * Every route handler and server component that touches user data calls this, so
 * "protected" is the default rather than something each file has to remember.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("You need to sign in to continue.");
    this.name = "UnauthorizedError";
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await withTransaction(async (client) => {
    await client.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  });
}

/**
 * Development-only OTP check.
 *
 * There is no SMS provider. The expected code comes from DEMO_OTP and is shown
 * in the sign-in UI, and the UI never claims a message was sent.
 */
export function checkDemoOtp(entered: string): boolean {
  const expected = process.env.DEMO_OTP ?? "123456";
  if (entered.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(entered), Buffer.from(expected));
}