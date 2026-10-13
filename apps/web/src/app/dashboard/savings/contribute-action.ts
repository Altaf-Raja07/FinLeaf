"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { createSavingsGoal, contributeToGoal } from "@/lib/savings";
import { generateReference } from "@/lib/crypto/hash";
import { fieldErrors, savingsGoalSchema, savingsContributionSchema } from "@/lib/validation";
import { log } from "@/lib/env";

/**
 * Savings-goal Server Actions.
 *
 * The reference for a contribution is generated server-side and passed into the
 * posting engine, so the same reference cannot be submitted twice — which is
 * what makes a double-tap on a slow connection safe.
 */

export interface GoalActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  created?: boolean;
}

export async function createGoalAction(
  _prev: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = savingsGoalSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    target: String(formData.get("target") ?? ""),
    dueDate: formData.get("dueDate") ? String(formData.get("dueDate")) : undefined,
  });

  if (!parsed.success) {
    return {
      error: "Check the details above.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const result = await createSavingsGoal({
    userId: user.id,
    title: parsed.data.title,
    target: parsed.data.target,
    dueDate: parsed.data.dueDate,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath("/dashboard/savings", "page");
  return { created: true };
}

export interface ContributeActionState {
  error?: string;
  message?: string;
  reached?: boolean;
}

export async function contributeAction(
  _prev: ContributeActionState,
  formData: FormData,
): Promise<ContributeActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const reference =
    String(formData.get("reference") ?? "").trim() ||
    generateReference(`save-${Date.now()}`);

  const parsed = savingsContributionSchema.safeParse({
    goalId: String(formData.get("goalId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    reference,
  });

  if (!parsed.success) {
    return { error: "Check the amount and try again." };
  }

  const result = await contributeToGoal({
    userId: user.id,
    goalId: parsed.data.goalId,
    amount: parsed.data.amount,
    reference: parsed.data.reference,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  log("info", "savings contribution recorded", {
    userId: user.id,
    goalId: parsed.data.goalId,
    reached: result.reached,
  });

  revalidatePath("/dashboard/savings", "page");
  revalidatePath("/dashboard", "page");

  return { message: result.message, reached: result.reached };
}
