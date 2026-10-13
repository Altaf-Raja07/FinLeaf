import "server-only";
import { prisma } from "@/lib/db";
import type { User, Account } from "@/generated/prisma/client";

/**
 * Authorisation helpers for route handlers.
 *
 * `proxy.ts` already redirects unauthenticated page requests, but that is a
 * user-experience convenience, not a security control: it is matched by path
 * and can be bypassed by calling an API route directly. Every handler calls
 * {@link requireUser} itself.
 */

export interface AuthedUser extends User {
  accounts: Account[];
}

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<AuthedUser> {
  // Imported lazily to keep this module free of a cycle: session.ts depends on
  // db.ts, and guard.ts is used by routes that also use session.ts.
  const { currentUser } = await import("@/lib/auth/session");

  const user = await currentUser();
  if (!user) {
    throw new AuthError(401, "Sign in to continue", "unauthenticated");
  }
  return user as AuthedUser;
}

/** Requires an administrator. */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new AuthError(403, "Administrator access required", "forbidden");
  }
  return user;
}

/**
 * Returns the user's primary account.
 *
 * "Primary" means the oldest still-open account, which is deterministic and
 * avoids an extra nullable column that would need migrating the day two
 * accounts opened.
 */
export async function requireAccount(userId: string): Promise<Account> {
  const account = await prisma.account.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { openedAt: "asc" },
  });

  if (!account) {
    throw new AuthError(403, "No active account", "no_active_account");
  }
  return account;
}
