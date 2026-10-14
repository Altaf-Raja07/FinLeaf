"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { vouchForMember } from "@/lib/groups";
import { refreshTrustScore } from "@/lib/trust";
import { fieldErrors, vouchSchema } from "@/lib/validation";

/**
 * Vouch Server Action.
 *
 * Re-validates the circle membership server-side rather than trusting the form,
 * then refreshes the trust score. The refresh matters because a vouch does not
 * add to the score by itself: the score reads `group_activity`, which is derived
 * from real `CircleMember` rows, so a vouch from someone who is not genuinely
 * active changes nothing.
 */

export interface VouchState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

export async function vouchAction(
  _prev: VouchState,
  formData: FormData,
): Promise<VouchState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = vouchSchema.safeParse({
    circleId: String(formData.get("circleId") ?? ""),
    toUserId: String(formData.get("toUserId") ?? ""),
    weight: String(formData.get("weight") ?? "1"),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  if (!parsed.success) {
    return {
      error: "Check the details above.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const result = await vouchForMember({
    fromUserId: user.id,
    circleId: parsed.data.circleId,
    toUserId: parsed.data.toUserId,
    weight: parsed.data.weight,
    note: parsed.data.note,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  // Group activity feeds the trust score through real membership, so the score
  // is recomputed rather than being adjusted by a fixed amount for the vouch.
  await refreshTrustScore(user.id);

  revalidatePath("/dashboard/circles", "page");

  return { message: "Vouch recorded." };
}
