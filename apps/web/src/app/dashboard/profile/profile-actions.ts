"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser, revokeAllSessions } from "@/lib/auth/session";
import { changePassword } from "@/lib/auth/service";
import { setRequestLocale } from "@/lib/locale";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, profileUpdateSchema, changePasswordSchema } from "@/lib/validation";
import { log } from "@/lib/env";

/**
 * Profile actions.
 *
 * The one behaviour worth calling out: signing out of every other device
 * revokes *all* sessions including the current one, which then forces a fresh
 * sign-in. That is correct — leaving the new session alone would be a half
 * measure — but it means the caller must be warned, because their current form
 * submission will end the session it was made from.
 */

export interface ProfileState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = profileUpdateSchema.safeParse({
    name: formData.get("name") ? String(formData.get("name")) : undefined,
    village: formData.get("village") ? String(formData.get("village")) : undefined,
    preferredLang: formData.get("preferredLang")
      ? String(formData.get("preferredLang"))
      : undefined,
    email: formData.get("email")
      ? formData.get("email") === ""
        ? undefined
        : String(formData.get("email"))
      : undefined,
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  });

  // A language change must take effect immediately, not on the next request, so
  // the cookie is written here as part of the same update.
  if (parsed.data.preferredLang) {
    await setRequestLocale(parsed.data.preferredLang);
  }

  revalidatePath("/dashboard/profile", "page");
  revalidatePath("/dashboard", "layout");

  return { message: "Profile saved." };
}

export interface PasswordState {
  error?: string;
  message?: string;
}

export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Check the passwords and try again." };
  }

  const result = await changePassword({
    userId: user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  log("info", "password changed from profile", { userId: user.id });

  return { message: "Your password was changed." };
}

export async function signOutEverywhere(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const revoked = await revokeAllSessions(user.id);

  await recordAudit({
    userId: user.id,
    action: "SIGN_OUT",
    detail: { everywhere: true, revoked },
  });

  // Includes the caller's own session, so they land on sign-in. That is the
  // point of the action and the client says so where it is offered.
  revalidatePath("/dashboard", "layout");
  redirect("/sign-in");
}

export interface SessionView {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  isCurrent: boolean;
}

/**
 * Live sessions for the signed-in user.
 *
 * The subject comes from the session, never from an argument: every export of a
 * `"use server"` module is a remotely callable endpoint, and this returns the IP
 * address and user agent of every live session.
 */
export async function listSessions(): Promise<SessionView[]> {
  const { currentSessionId, currentUserId } = await import("@/lib/auth/session");

  const userId = await currentUserId();
  if (!userId) return [];

  const current = await currentSessionId();

  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ip: session.ip,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    isCurrent: session.id === current,
  }));
}
