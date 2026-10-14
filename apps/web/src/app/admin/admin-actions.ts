"use server";

import { revalidatePath } from "next/cache";
import { updateUser, resolveFlag } from "@/lib/admin";
import { adminUserUpdateSchema, anomalyResolveSchema } from "@/lib/validation";

/**
 * Administrative actions.
 *
 * Every one of these calls `updateUser` / `resolveFlag`, which read the role from
 * the database rather than from the session alone, so a tampered request cannot
 * act as an administrator.
 */

export async function updateUserAction(input: {
  userId: string;
  status?: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "CLOSED";
  role?: "USER" | "ADMIN";
}): Promise<{ ok: boolean; message?: string }> {
  const { currentUser } = await import("@/lib/auth/session");
  const admin = await currentUser();
  if (!admin) return { ok: false, message: "Sign in." };

  const parsed = adminUserUpdateSchema.pick({ userId: true, status: true, role: true }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid target." };

  const result = await updateUser({
    adminId: admin.id,
    userId: parsed.data.userId,
    status: parsed.data.status,
    role: parsed.data.role,
  });

  if (result.ok) revalidatePath("/admin", "page");
  return result;
}

export async function resolveFlagAction(flagId: string): Promise<void> {
  const { currentUser } = await import("@/lib/auth/session");
  const admin = await currentUser();
  if (!admin) return;

  const parsed = anomalyResolveSchema.safeParse({ flagId });
  if (!parsed.success) return;

  await resolveFlag({ adminId: admin.id, flagId: parsed.data.flagId });
  revalidatePath("/admin", "page");
}
