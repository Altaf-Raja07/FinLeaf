"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth/session";
import { RATE_LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { repayLoan } from "@/lib/banking/loans";
import { generateReference } from "@/lib/crypto/hash";
import { fieldErrors, loanRepaySchema } from "@/lib/validation";

/**
 * Repayment Server Action.
 *
 * The idempotency reference is generated server-side rather than trusted from
 * the form, so a double submit on a slow connection cannot post twice; the
 * database's unique index on `reference` is the backstop either way.
 */

export interface RepayActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

export async function repayLoanAction(
  _prev: RepayActionState,
  formData: FormData,
): Promise<RepayActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const ip = clientIp(await headers());
  const [userLimited, ipLimited] = await Promise.all([
    rateLimit(`loan:repay:user:${user.id}`, RATE_LIMITS.transfer),
    rateLimit(`loan:repay:ip:${ip}`, RATE_LIMITS.transfer),
  ]);
  if (!userLimited.allowed || !ipLimited.allowed) {
    return { error: "Too many repayments in a short time. Please wait a moment." };
  }


  const reference =
    String(formData.get("reference") ?? "").trim() ||
    generateReference(`repay-${Date.now()}`);

  const parsed = loanRepaySchema.safeParse({
    loanId: String(formData.get("loanId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    reference,
  });

  if (!parsed.success) {
    return {
      error: "Check the details above.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const result = await repayLoan({
    userId: user.id,
    loanId: parsed.data.loanId,
    amount: parsed.data.amount,
    reference: parsed.data.reference,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath("/dashboard/loans", "page");
  revalidatePath("/dashboard", "page");

  return { message: result.message };
}
