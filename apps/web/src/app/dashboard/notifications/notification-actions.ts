"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { markNotificationsRead } from "@/lib/notify";

/**
 * Notification actions.
 *
 * Both actions mark read rather than delete. A notification is a record of
 * something that happened to the account — a repayment that was taken, a badge
 * that was earned — and a user who clears their list by accident should still
 * be able to find out what they missed.
 *
 * The unread badge lives in the dashboard layout, so the layout is revalidated
 * alongside the page; without that the badge would keep counting something the
 * user has already read.
 */

export async function markAllReadAction(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  await markNotificationsRead(user.id);

  revalidatePath("/dashboard/notifications", "page");
  revalidatePath("/dashboard", "layout");
}

export async function markReadAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const id = String(formData.get("id") ?? "").trim();
  if (id.length === 0) return;

  // `markNotificationsRead` scopes the update to this user, so an id belonging
  // to someone else silently affects nothing rather than needing a check here.
  await markNotificationsRead(user.id, [id]);

  revalidatePath("/dashboard/notifications", "page");
  revalidatePath("/dashboard", "layout");
}
