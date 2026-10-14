"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { createCircle, joinCircle } from "@/lib/groups";
import { refreshTrustScore } from "@/lib/trust";
import { circleCreateSchema, circleJoinSchema, fieldErrors } from "@/lib/validation";

/**
 * Circle create/join actions.
 *
 * Joining a circle recomputes the trust score, because `group_activity` is one of
 * the model's eight inputs and it is read from real `CircleMember` rows rather
 * than from a counter.
 */

export async function createCircleAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = circleCreateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    village: String(formData.get("village") ?? ""),
  });

  if (!parsed.success) {
    void fieldErrors(parsed.error);
    return;
  }

  await createCircle({
    userId: user.id,
    name: parsed.data.name,
    village: parsed.data.village,
  });

  await refreshTrustScore(user.id);
  revalidatePath("/dashboard/circles", "page");
}

export async function joinCircleAction(circleId: string): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = circleJoinSchema.safeParse({ circleId });

  if (!parsed.success) return;

  const result = await joinCircle({ userId: user.id, circleId: parsed.data.circleId });

  if (result.ok) {
    await refreshTrustScore(user.id);
    revalidatePath("/dashboard/circles", "page");
  }
}
