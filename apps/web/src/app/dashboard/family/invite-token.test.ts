import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { generateInviteToken, hashInviteToken } from "./invite-token";

/**
 * The invite-token digest rule.
 *
 * These are the checks that cannot be made by reading the code: that the token
 * really is 256 bits of entropy, that the stored form really is a SHA-256
 * digest of it, and that the raw token is nowhere in the digest. If any of
 * these fail, a live household invitation is either guessable or recoverable
 * from the database.
 */

describe("generateInviteToken", () => {
  it("produces a 64-character hex string", () => {
    const token = generateInviteToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not repeat", () => {
    // Two draws from 256 bits colliding would be a bug in the CSPRNG, not bad
    // luck, so this is a real assertion rather than a probabilistic one.
    const tokens = new Set(Array.from({ length: 50 }, () => generateInviteToken()));

    expect(tokens.size).toBe(50);
  });
});

describe("hashInviteToken", () => {
  it("matches the known SHA-256 of a fixed token", () => {
    expect(hashInviteToken("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("is deterministic, so a lookup by digest finds the same row twice", () => {
    const token = generateInviteToken();

    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
  });

  it("never contains the raw token", () => {
    const token = generateInviteToken();

    expect(hashInviteToken(token)).not.toContain(token);
    // Not even a fragment of it: a partial leak is still a leak.
    expect(hashInviteToken(token)).not.toContain(token.slice(0, 16));
  });

  it("separates two tokens that differ by one character", () => {
    const token = generateInviteToken();
    const flipped = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;

    expect(hashInviteToken(flipped)).not.toBe(hashInviteToken(token));
  });

  it("agrees with the platform's own SHA-256 implementation", () => {
    const token = generateInviteToken();

    // Guard against a future edit swapping the digest for something weaker.
    expect(hashInviteToken(token)).toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
  });
});
