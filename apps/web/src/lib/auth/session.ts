import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  generateSessionToken,
  hashSessionToken,
} from "@/lib/crypto";
import { env, isProduction } from "@/lib/env";

/**
 * Session management.
 *
 * Sessions are opaque random tokens stored as digests, not JWTs. A JWT cannot
 * be revoked before it expires without keeping a deny-list, and being able to
 * revoke a session instantly matters for a banking product — a user who loses
 * a phone must be able to cut off access immediately. The trade-off is one
 * database read per authenticated request, which is paid for with the
 * {@link currentUser} request memo below.
 */

export const SESSION_COOKIE = "finleaf_session";

const SESSION_TTL_DAYS = 30;
const SESSION_REFRESH_THRESHOLD_DAYS = 1;

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Issues a session row and returns the raw token for the client cookie. */
export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      ip: await requestIp(),
      userAgent: await requestUserAgent(),
    },
  });

  return { token, expiresAt };
}

/**
 * Resolves the signed-in user from the session cookie, or null.
 *
 * Wrapped in React's `cache` so the several components on a page that each need
 * the current user share one database round trip within a render pass.
 *
 * Expired and revoked sessions are treated as absent, and the raw token is
 * re-checked in constant time against the stored digest.
 */
export const currentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: { accounts: { where: { status: "ACTIVE" }, orderBy: { openedAt: "asc" } } },
      },
    },
  });

  if (!session) return null;

  if (session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  if (session.user.status === "SUSPENDED" || session.user.status === "CLOSED") {
    return null;
  }

  return session.user;
});

/** The signed-in user id, or null. Cheaper than {@link currentUser}. */
export const currentUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { userId: true, expiresAt: true, revokedAt: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  return session.userId;
});

/**
 * Slides the session expiry forward once it is within a day of lapsing, so an
 * active user is never signed out mid-task while an abandoned session still
 * dies on schedule.
 */
export async function touchSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session || session.revokedAt) return;

  const remainingMs = session.expiresAt.getTime() - Date.now();
  if (remainingMs > SESSION_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) {
    return;
  }

  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.session.update({
    where: { tokenHash },
    data: { expiresAt, lastSeenAt: new Date() },
  });

  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

/** Revokes the current session and clears its cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Revokes every session for a user. Used on password change and when an
 * administrator suspends an account.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Writes the session cookie. Must be called from a Route Handler or Server Action. */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function requestIp(): Promise<string | undefined> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
}

async function requestUserAgent(): Promise<string | undefined> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 256) ?? undefined;
}

/** Housekeeping for the scheduled maintenance job. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}

/** Throws at boot in production if the deployment has no reachable origin. */
export function assertAppUrlConfigured(): void {
  if (isProduction() && env().APP_URL.startsWith("http://")) {
    throw new Error(
      "APP_URL must use https in production; refusing to issue cookies over plaintext.",
    );
  }
}
