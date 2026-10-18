import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Pure credential primitives.
 *
 * This module deliberately imports neither the environment nor any server-only
 * module, because it needs to run in three places: inside the Next.js server,
 * in the seed script, and in unit tests. Splitting the environment-dependent
 * pepper logic into ./pepper keeps that possible without a conditional import.
 *
 * Nothing here is reversible. No credential is ever returned by these functions,
 * only a digest or a freshly generated value.
 */

const BCRYPT_ROUNDS = 12;

/**
 * Cost factor for password hashing.
 *
 * 12 is the current common default and is roughly a couple of hundred
 * milliseconds on server hardware. It needs to be expensive enough to make
 * offline guessing costly if the hash ever leaks, but cheap enough that a
 * legitimate sign-in is not slow: this value is a deliberate balance, not a
 * maximum.
 */

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password.
 *
 * Returns false rather than throwing on a malformed stored hash, so a corrupted
 * record is indistinguishable from a wrong password to the caller.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

/**
 * A 6-digit one-time code drawn from a CSPRNG.
 *
 * `randomInt` rather than `Math.random()`: a predictable code generator is
 * entirely bypassable, since the next code is derivable from the last one.
 */
export function generateOtpCode(digits = 6): string {
  // `randomInt` requires a safe-integer range, so anything past 15 digits would
  // throw ERR_OUT_OF_RANGE rather than produce a weak code.
  if (digits > 15) {
    throw new Error("generateOtpCode supports at most 15 digits");
  }
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return String(randomInt(min, max));
}

/**
 * A high-entropy opaque secret: the placeholder password an account is created
 * with when its owner signs in by OTP and has never chosen a password.
 *
 * This is deliberately not `generateOtpCode(n)` for large `n` — beyond 15 digits
 * the arithmetic leaves the safe-integer range and `randomInt` throws. It is a
 * base64url CSPRNG draw, which is what a secret wants to be anyway.
 */
export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** 256 bits of CSPRNG entropy, URL-safe. Raw session token. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** 128 bits, hex. Used for idempotency references on money movement. */
export function generateReference(prefix: string): string {
  return `${prefix}-${randomBytes(16).toString("hex")}`;
}

/**
 * A stable, salted digest for anything that needs a lookup key rather than a
 * secret: idempotency references, invite tokens, cache keys.
 *
 * Not for passwords — those use bcrypt above.
 */
export function digest(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/**
 * Constant-time comparison.
 *
 * The length is compared first because `timingSafeEqual` throws when the two
 * buffers differ in length, and the length of a digest is fixed so nothing is
 * leaked by comparing it.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Masks a phone number for logs and audit trails, keeping only the country
 * prefix and the last four digits: +919876543210 -> +9•••••••3210
 */
export function maskPhone(phone: string): string {
  const visibleTail = 4;
  if (phone.length <= visibleTail + 2) return "•".repeat(phone.length);
  const hidden = phone.length - visibleTail - 2;
  return `${phone.slice(0, 2)}${"•".repeat(hidden)}${phone.slice(-visibleTail)}`;
}
