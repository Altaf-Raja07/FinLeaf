"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { createNotification } from "@/lib/notify";
import { appUrl, env, log } from "@/lib/env";
import {
  familyCreateSchema,
  familyInviteSchema,
  familyLeaveSchema,
  familyRemoveMemberSchema,
  familyToggleSpendSchema,
  fieldErrors,
} from "@/lib/validation";

/**
 * Family / shared-visibility groups.
 *
 * ## What `canSpend` is, and what it is not
 *
 * It is a flag on a membership row that records what a household agreed to. It
 * is **not** an implemented permission: FinLeaf has no shared spending, no
 * linked accounts and no delegated authority, so no member can move money from
 * the owner's account through this product however the flag is set. The
 * interface says so at the point of the flag, and the invite screen repeats it.
 * Anything less would be a promise the platform cannot keep.
 *
 * ## Invite links
 *
 * An invitation carries a single-use token. Only its SHA-256 digest is stored,
 * so a leaked database does not hand out live links, and the raw token is never
 * written to the log — it exists once, in the response that shows it on screen.
 */

const FAMILY_PATH = "/dashboard/family";
const INVITE_PATH = "/invite";

/** Seven days: long enough for a phone to reach someone, short enough to matter. */
const INVITE_TTL_DAYS = 7;

export interface FamilyMemberView {
  /** Id of the membership row, which is what the owner-only actions address. */
  id: string;
  userId: string;
  name: string;
  /** Null for anyone who is not the owner of the group. */
  phone: string | null;
  canSpend: boolean;
  joinedAt: Date;
  isOwner: boolean;
}

export interface FamilyGroupView {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  isOwner: boolean;
  members: FamilyMemberView[];
  /** My own permission in this group; null when I am the owner. */
  myCanSpend: boolean | null;
  /** Live invitations. Owner only — an invite is the owner's business. */
  pendingInvites: Array<{
    id: string;
    phone: string;
    canSpend: boolean;
    expiresAt: Date;
  }>;
}

/**
 * Groups I own or belong to.
 *
 * The owner is not stored as a member row — they *are* the account holder — so
 * the member list is the owner plus the invitation-derived rows, and a
 * membership is only ever a join, never a self-join.
 */
export async function listFamilyGroups(userId: string): Promise<FamilyGroupView[]> {
  const rows = await prisma.familyGroup.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      ownerId: true,
      createdAt: true,
      owner: { select: { name: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          canSpend: true,
          joinedAt: true,
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      invitations: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, phone: true, canSpend: true, expiresAt: true },
      },
    },
  });

  return rows.map((row) => {
    const isOwner = row.ownerId === userId;
    const mine = row.members.find((member) => member.user.id === userId);

    return {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      ownerName: row.owner.name,
      createdAt: row.createdAt,
      isOwner,
      myCanSpend: isOwner ? null : (mine?.canSpend ?? false),
      // A phone number is personal data. The owner is the person who invited
      // these members, so they already have it; a fellow member is not owed it.
      members: row.members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        phone: isOwner ? member.user.phone : null,
        canSpend: member.canSpend,
        joinedAt: member.joinedAt,
        isOwner: member.user.id === row.ownerId,
      })),
      pendingInvites: isOwner
        ? row.invitations.map((invite) => ({
            id: invite.id,
            phone: invite.phone,
            canSpend: invite.canSpend,
            expiresAt: invite.expiresAt,
          }))
        : [],
    };
  });
}

export interface FamilyFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  /** The raw invite link, shown once to the inviter to share. */
  inviteLink?: string;
  /** Whether this deployment could send an SMS at all. */
  smsConfigured?: boolean;
}

/**
 * Creates a group owned by the caller.
 *
 * The owner is not inserted as a member: there is nothing to toggle for them,
 * and a second source of truth for "who owns this account" is a bug waiting to
 * happen.
 */
export async function createFamilyGroupAction(
  _prev: FamilyFormState,
  formData: FormData,
): Promise<FamilyFormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = familyCreateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: "Check the name and try again.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  await prisma.familyGroup.create({
    data: { name: parsed.data.name, ownerId: user.id },
    select: { id: true },
  });

  revalidatePath(FAMILY_PATH, "page");
  return { message: `Created ${parsed.data.name}.` };
}

/**
 * Invites a phone number to a group.
 *
 * Only the owner may invite. The group is read back rather than trusted from
 * the form, so a group id typed into a request means nothing about who owns it.
 */
export async function inviteMemberAction(
  _prev: FamilyFormState,
  formData: FormData,
): Promise<FamilyFormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = familyInviteSchema.safeParse({
    groupId: String(formData.get("groupId") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    canSpend: formData.get("canSpend") === "true" || formData.get("canSpend") === "on",
  });

  if (!parsed.success) {
    return {
      error: "Check the phone number and try again.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { groupId, phone, canSpend } = parsed.data;

  const group = await prisma.familyGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!group || group.ownerId !== user.id) {
    return { error: "We could not find that group." };
  }

  if (phone === user.phone) {
    return { error: "You are already the account holder for this group." };
  }

  // Already in? A second membership row would trip the unique index, so the
  // case is answered here where it can be explained.
  const existingUser = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });

  if (existingUser) {
    const already = await prisma.familyMember.findUnique({
      where: {
        groupId_userId: { groupId: group.id, userId: existingUser.id },
      },
      select: { id: true },
    });

    if (already) {
      return { error: "That person is already in this group." };
    }
  }

  // 256 bits of CSPRNG entropy, URL-safe. Hashed before it is stored, so the
  // only place the raw token ever exists is the response below.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$transaction([
    // Earlier links for the same pair are expired rather than left live: a link
    // sent to a number that has since changed hands should not still open the
    // household's visibility.
    prisma.familyInvitation.updateMany({
      where: { groupId: group.id, phone, acceptedAt: null },
      data: { expiresAt: new Date() },
    }),
    prisma.familyInvitation.create({
      data: { groupId: group.id, phone, canSpend, tokenHash, expiresAt },
      select: { id: true },
    }),
  ]);

  if (existingUser) {
    // The notification deliberately carries no link: a link in a row is a
    // second copy of a secret that was supposed to be shown once.
    await createNotification({
      userId: existingUser.id,
      type: "SYSTEM",
      title: "You were invited to a family group",
      body: `You have been invited to join ${group.name}. Open the invite link you were sent to accept.`,
      href: FAMILY_PATH,
    });
  }

  const inviteLink = `${appUrl()}${INVITE_PATH}?token=${token}`;

  log("info", "family invitation created", {
    groupId: group.id,
    // The phone, not the number of digits of the token. Never the token.
    invitee: existingUser ? "registered" : "unregistered",
    smsProvider: smsProvider().provider,
  });

  revalidatePath(FAMILY_PATH, "page");

  return {
    message: "Invite created. Share the link below with them.",
    inviteLink,
    smsConfigured: smsProvider().configured,
  };
}

/**
 * Turns a member's spending permission on or off.
 *
 * Owner only, and the membership row is re-read against the group so a member
 * id from one group cannot be pointed at another.
 */
export async function setMemberCanSpendAction(
  _prev: FamilyFormState,
  formData: FormData,
): Promise<FamilyFormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = familyToggleSpendSchema.safeParse({
    groupId: String(formData.get("groupId") ?? ""),
    memberId: String(formData.get("memberId") ?? ""),
    canSpend: formData.get("canSpend") === "true",
  });

  if (!parsed.success) {
    return { error: "We could not find that member." };
  }

  const { groupId, memberId, canSpend } = parsed.data;

  const group = await prisma.familyGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!group || group.ownerId !== user.id) {
    return { error: "Only the account holder can change spending permission." };
  }

  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, groupId: group.id },
    select: { id: true, userId: true },
  });

  if (!member) {
    return { error: "We could not find that member." };
  }

  await prisma.familyMember.update({
    where: { id: member.id },
    data: { canSpend },
    select: { id: true },
  });

  await createNotification({
    userId: member.userId ?? "",
    type: "SYSTEM",
    title: "Your permission in a family group changed",
    body: `Your access to ${group.name} is now ${canSpend ? "spend permission" : "view only"}.`,
    href: FAMILY_PATH,
  });

  revalidatePath(FAMILY_PATH, "page");
  return { message: "Spending permission updated." };
}

/** Owner-only removal of a member. */
export async function removeMemberAction(
  _prev: FamilyFormState,
  formData: FormData,
): Promise<FamilyFormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = familyRemoveMemberSchema.safeParse({
    groupId: String(formData.get("groupId") ?? ""),
    memberId: String(formData.get("memberId") ?? ""),
  });

  if (!parsed.success) {
    return { error: "We could not find that member." };
  }

  const { groupId, memberId } = parsed.data;

  const group = await prisma.familyGroup.findUnique({
    where: { id: groupId },
    select: { id: true, ownerId: true },
  });

  if (!group || group.ownerId !== user.id) {
    return { error: "Only the account holder can remove a member." };
  }

  // Scoped to the group as well as the row id, so a membership id belonging to
  // some other household cannot be removed through this form.
  const removed = await prisma.familyMember.deleteMany({
    where: { id: memberId, groupId: group.id },
  });

  if (removed.count === 0) {
    return { error: "We could not find that member." };
  }

  revalidatePath(FAMILY_PATH, "page");
  return { message: "Removed from the group." };
}

/**
 * Leaves a group.
 *
 * Only a member can leave: the owner has nobody to hand the account to, and a
 * group left ownerless would be an orphan nobody can manage or be removed from.
 */
export async function leaveFamilyGroupAction(
  _prev: FamilyFormState,
  formData: FormData,
): Promise<FamilyFormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = familyLeaveSchema.safeParse({
    groupId: String(formData.get("groupId") ?? ""),
  });

  if (!parsed.success) {
    return { error: "We could not find that group." };
  }

  const group = await prisma.familyGroup.findUnique({
    where: { id: parsed.data.groupId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!group) {
    return { error: "We could not find that group." };
  }

  if (group.ownerId === user.id) {
    return {
      error:
        "You are the account holder for this group, so there is nothing to leave. Remove your members instead.",
    };
  }

  const left = await prisma.familyMember.deleteMany({
    where: { groupId: group.id, userId: user.id },
  });

  if (left.count === 0) {
    return { error: "You are not a member of that group." };
  }

  revalidatePath(FAMILY_PATH, "page");
  return { message: "You left the group." };
}

/**
 * Whether this deployment can send an SMS at all.
 *
 * `SMS_PROVIDER=console` writes its message to the server log. That is right for
 * a one-time code and wrong for an invite link: the link exists exactly once, so
 * logging it is both a way to lose it and a way to leak it. Only a real provider
 * with its credentials present counts as configured.
 */
function smsProvider(): { configured: boolean; provider: string } {
  const config = env();

  if (
    config.SMS_PROVIDER === "twilio" &&
    config.TWILIO_ACCOUNT_SID &&
    config.TWILIO_AUTH_TOKEN &&
    config.TWILIO_FROM_NUMBER
  ) {
    return { configured: true, provider: "twilio" };
  }

  if (config.SMS_PROVIDER === "msg91" && config.MSG91_AUTH_KEY) {
    return { configured: true, provider: "msg91" };
  }

  return { configured: false, provider: config.SMS_PROVIDER };
}
