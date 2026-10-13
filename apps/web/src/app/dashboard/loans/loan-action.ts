"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { applyForLoan } from "@/lib/banking/loans";
import { fieldErrors, loanApplySchema } from "@/lib/validation";
import { log } from "@/lib/env";

/**
 * Loan application Server Action.
 *
 * The eligibility decision itself lives in `src/lib/trust` (policy) and the
 * model (the ML service); this action validates the request, delegates, and
 * surfaces the result. It never decides an amount itself.
 */

export interface LoanActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  approved?: { loanId: string; outstanding: string };
}

export async function applyForLoanAction(
  _prev: LoanActionState,
  formData: FormData,
): Promise<LoanActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = loanApplySchema.safeParse({
    amount: String(formData.get("amount") ?? ""),
    termMonths: String(formData.get("termMonths") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: "Check the details above.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const result = await applyForLoan({
    userId: user.id,
    amount: parsed.data.amount,
    termMonths: parsed.data.termMonths,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  log("info", "loan disbursed", { userId: user.id, loanId: result.loanId });

  revalidatePath("/dashboard/loans", "page");
  revalidatePath("/dashboard", "page");

  return {
    approved: {
      loanId: result.loanId,
      outstanding: result.outstanding?.toString() ?? "0",
    },
  };
}
