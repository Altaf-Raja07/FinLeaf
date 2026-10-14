import { createHash, randomBytes } from "node:crypto";

/**
 * Invite-link tokens.
 *
 * A token is 256 bits from the CSPRNG, hex-encoded. Only its SHA-256 digest is
 * stored, on `FamilyInvitation.tokenHash`, so a leaked database does not hand
 * out live household invitations. The raw token exists in exactly one place:
 * the response that shows it on screen for the inviter to hand over.
 *
 * It is never written to a log. A logged secret is a leaked secret that nobody
 * can revoke, and the log is the one place an operator will look first.
 *
 * The two functions live apart from the actions so the rule — "we store a
 * digest, never the token" — is enforced in one file, and so the invite page in
 * a different route can hash a token it received without duplicating the
 * algorithm.
 */

/** 32 bytes is 256 bits: far beyond brute force, and URL-safe once hex-encoded. */
const TOKEN_BYTES = 32;

export function generateInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
