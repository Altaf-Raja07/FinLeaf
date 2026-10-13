"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type TxCategory } from "@/generated/prisma/client";
import { requireAccount } from "@/lib/auth/guard";
import { currentUser } from "@/lib/auth/session";
import {
  transfer,
  TransferError,
  isTransferCategory,
} from "@/lib/banking/transfer";
import { InsufficientFundsError, AccountUnavailableError } from "@/lib/banking/ledger";
import { generateReference } from "@/lib/crypto/hash";
import { rateLimit, RATE_LIMITS, clientIp } from "@/lib/rate-limit";
import { fieldErrors, transferSchema } from "@/lib/validation";
import { headers } from "next/headers";

/**
 * Money movement.
 *
 * This is the single write path for sending money to another person, and it is
 * deliberately narrow: re-check the caller, rate limit, validate, then hand off
 * to the posting engine. Everything that has to be true of the money is enforced
 * in `src/lib/banking/ledger.ts` and `src/lib/banking/transfer.ts`, which are
 * the only modules that touch a balance.
 *
 * The idempotency reference is generated server-side if the client did not
 * supply one, so a retried submission cannot double-debit.
 */

export interface TransferState {
  error?: string;
  fieldErrors?: Record<string, string>;
  flagged?: boolean;
  co2eKg?: string;
}

export async function executeTransfer(
  _prev: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const account = await requireAccount(user.id);

  // A retried form submission must not move money twice, so the reference the
  // user's submission carries is the one that is used.
  const clientReference = String(formData.get("reference") ?? "").trim();
  const reference = clientReference ||
    generateReference(`txn-${account.id.slice(0, 6)}`);

  const parsed = transferSchema.safeParse({
    to: String(formData.get("to") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
    reference,
  });

  if (!parsed.success) {
    return {
      error: "Check the details above.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const ip = clientIp(await headers());
  const limited = await rateLimit(`transfer:user:${user.id}`, RATE_LIMITS.transfer);
  if (!limited.allowed) {
    return { error: "Too many payments in a short time. Wait a moment and try again." };
  }
  const ipLimited = await rateLimit(`transfer:ip:${ip}`, RATE_LIMITS.transfer);
  if (!ipLimited.allowed) {
    return { error: "Too many payments in a short time. Wait a moment and try again." };
  }

  try {
    const result = await transfer({
      fromUserId: user.id,
      fromAccountId: account.id,
      to: parsed.data.to,
      amount: parsed.data.amount,
      note: parsed.data.note,
      // The category is read straight from the form rather than from the
      // parsed schema, because it is a carbon-accounting choice and not a
      // value the schema validates. An unrecognised category falls back to
      // `OTHER` in the carbon module, which uses a blended factor.
      category: isTransferCategory(String(formData.get("category") ?? ""))
        ? (String(formData.get("category")) as TxCategory)
        : "TRANSFER",
      reference: parsed.data.reference,
      locale: user.preferredLang,
    });

    revalidatePath("/dashboard", "page");
    revalidatePath("/dashboard/history", "page");

    return {
      flagged: result.flagged,
      co2eKg: result.co2eKg.toFixed(2),
    };
  } catch (error) {
    if (
      error instanceof InsufficientFundsError ||
      error instanceof AccountUnavailableError ||
      error instanceof TransferError
    ) {
      return { error: error.message };
    }

    // A duplicate reference means this exact payment already went through.
    // Reporting failure would invite the user to retry and pay twice.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "That payment has already been sent." };
    }

    return { error: "We could not send that payment. Please try again." };
  }
}
