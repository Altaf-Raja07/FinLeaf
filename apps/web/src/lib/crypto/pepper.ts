import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Pepper-dependent digests.
 *
 * Both digests here are HMAC-SHA256 over a construction isolated by a domain
 * string, keyed by APP_SECRET. The domain separation exists so the digest of an
 * OTP code can never be replayed as a session token digest, even though both are
 * produced by the same key.
 *
 * The pepper is what makes a leaked database insufficient to brute-force a live
 * code: an attacker who only has the rows still has to guess the secret that is
 * in the environment, not in the data.
 *
 * This module is `server-only` on purpose — it is the one part of the crypto
 * layer that reads configuration and must never reach a client bundle.
 */

const OTP_DOMAIN = "finleaf/otp/v1";
const SESSION_DOMAIN = "finleaf/session/v1";

function hmac(domain: string, value: string): string {
  return createHmac("sha256", env().APP_SECRET)
    .update(`${domain}\x1f${value}`)
    .digest("hex");
}

export function hashOtpCode(code: string): string {
  return hmac(OTP_DOMAIN, code);
}

export function hashSessionToken(token: string): string {
  return hmac(SESSION_DOMAIN, token);
}
