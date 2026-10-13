"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroySession, clearSessionCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth/session";

/**
 * Signs the current session out.
 *
 * Revokes the session row as well as clearing the cookie: clearing the cookie
 * alone would leave a valid token usable by anyone who had copied it.
 */
export async function signOut(): Promise<void> {
  const user = await currentUser();

  await destroySession();
  await clearSessionCookie();

  if (user) {
    await recordAudit({ userId: user.id, action: "SIGN_OUT" });
  }

  revalidatePath("/", "layout");
  redirect("/");
}
