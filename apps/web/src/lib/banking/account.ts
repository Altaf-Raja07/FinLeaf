import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Account } from "@/generated/prisma/client";

/**
 * Account provisioning.
 *
 * New accounts open with a zero balance. FinLeaf does not credit money from
 * nowhere: an account only holds funds once a real cash deposit or an incoming
 * transfer has been posted against it. That keeps the ledger honest and means
 * a fresh account is genuinely empty rather than holding fabricated credit.
 */

/**
 * 12-digit account number, starting with 9 as in the Indian banking numbering
 * convention. Random rather than sequential so an account number cannot be
 * guessed from a neighbouring one; uniqueness is guaranteed by the unique index
 * and the retry loop.
 */
function generateAccountNumber(): string {
  let digits = "";
  for (let i = 0; i < 11; i += 1) {
    digits += String(randomInt(0, 10));
  }
  return `9${digits}`;
}

const MAX_NUMBER_ATTEMPTS = 10;

export async function openAccount(
  userId: string,
): Promise<Account> {
  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt += 1) {
    const number = generateAccountNumber();
    const exists = await prisma.account.findUnique({
      where: { number },
      select: { id: true },
    });
    if (exists) continue;

    try {
      return await prisma.account.create({
        data: { userId, number },
      });
    } catch (error) {
      // Lost the race against a concurrent creation for the same number.
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    "Could not allocate a unique account number; please retry.",
  );
}

/** Returns the user's active account, opening one if none exists. */
export async function ensureAccount(userId: string): Promise<Account> {
  const existing = await prisma.account.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { openedAt: "asc" },
  });
  if (existing) return existing;
  return openAccount(userId);
}

/**
 * Resolves a transfer counterparty from what the sender typed: an account
 * number, or a phone number when the recipient registered with one.
 *
 * Returns null for an unknown counterparty; the caller reports "no such
 * account" without disclosing whether the phone is registered.
 */
export async function resolveCounterparty(
  identifier: string,
): Promise<{ account: Account; userId: string; name: string } | null> {
  const trimmed = identifier.trim();

  const byNumber = await prisma.account.findUnique({
    where: { number: trimmed },
    select: { id: true, userId: true, status: true },
  });

  if (byNumber && byNumber.status === "ACTIVE") {
    const user = await prisma.user.findUnique({
      where: { id: byNumber.userId },
      select: { name: true },
    });
    return {
      account: byNumber as Account,
      userId: byNumber.userId,
      name: user?.name ?? "FinLeaf member",
    };
  }

  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) {
    const user = await prisma.user.findUnique({
      where: { phone: trimmed },
      select: { id: true, name: true },
    });

    if (user) {
      const account = await prisma.account.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        orderBy: { openedAt: "asc" },
      });
      if (account) {
        return { account, userId: user.id, name: user.name };
      }
    }
  }

  return null;
}
