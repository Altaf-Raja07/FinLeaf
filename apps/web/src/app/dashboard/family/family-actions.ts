"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import {
  createFamilyGroup,
  inviteFamilyMember,
  acceptInvite,
  setMemberSpendPermission,
  removeFamilyMember,
  leaveFamilyGroup,
} from "@/lib/groups";
import { familyCreateSchema, familyInviteSchema } from "@/lib/validation";
import { log } from "@/lib/env";

/**
 * Family-group actions.
 *
 * Ownership is never taken from the form. `groupId` is read from the request and
 * then checked against `FamilyGroup.ownerId` from the database, because the
 * alternative is any signed-in user acting on someone else's household by
 * editing a hidden input.
 *
 * The raw invite token is returned exactly once, to the inviter, and only its
 * SHA-256 digest is stored. It is never logged.
 */

export interface FamilyActionState {
  error?: string;
  message?: string;
  /** Present after a successful invite, for the inviter to copy and share. */
  inviteLink?: string;
}

export async function createFamilyAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = familyCreateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });

  if (!parsed.success) return;

  await createFamilyGroup({ userId: user.id, name: parsed.data.name });

  revalidatePath("/dashboard/family", "page");
}

export async function inviteMemberAction(
  _prev: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = familyInviteSchema.safeParse({
    groupId: String(formData.get("groupId") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    canSpend: formData.get("canSpend") === "on" || formData.get("canSpend") === "true",
    locale: "en",
  });

  if (!parsed.success) {
    return { error: "Check the phone number and try again." };
  }

  const result = await inviteFamilyMember({
    ownerUserId: user.id,
    groupId: parsed.data.groupId,
    phone: parsed.data.phone,
    canSpend: parsed.data.canSpend,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  // The raw token exists only in this response. Nothing that outlives the
  // request records it.
  const inviteLink = `${frontendOrigin()}/invite?token=${result.value.token}`;

  log("info", "family invite created", {
    groupId: result.value.groupId,
    expiresAt: result.value.expiresAt,
  });

  revalidatePath("/dashboard/family", "page");

  return {
    message: "Invite created. Share the link — it works once, for seven days.",
    inviteLink,
  };
}

/**
 * The origin for building invite links.
 *
 * `APP_URL` is configured and validated at boot, so the link is built from that
 * rather than from a request header a client could set.
 */
function frontendOrigin(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function acceptInviteAction(token: string): Promise<void> {
  const user = await currentUser();
  if (!user) {
    const next = encodeURIComponent(`/invite?token=${token}`);
    redirect(`/sign-in?next=${next}`);
  }

  const result = await acceptInvite({ userId: user.id, token });

  if (!result.ok) {
    redirect(`/invite?token=${token}&error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/dashboard/family", "page");
  redirect("/dashboard/family");
}

export async function setSpendPermissionAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const groupId = String(formData.get("groupId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const canSpend = formData.get("canSpend") === "true";

  await setMemberSpendPermission({
    ownerUserId: user.id,
    groupId,
    membershipId,
    canSpend,
  });

  revalidatePath("/dashboard/family", "page");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  await removeFamilyMember({
    ownerUserId: user.id,
    groupId: String(formData.get("groupId") ?? ""),
    membershipId: String(formData.get("membershipId") ?? ""),
  });

  revalidatePath("/dashboard/family", "page");
}

export async function leaveGroupAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  await leaveFamilyGroup({
    userId: user.id,
    groupId: String(formData.get("groupId") ?? ""),
  });

  revalidatePath("/dashboard/family", "page");
}
