import "server-only";
import { prisma } from "@/lib/db";

/**
 * Community trust circles.
 *
 * The one thing this layer must get right: a vouch is an endorsement between two
 * real people in the same circle, not a tap that inflates a number. Every rule
 * that states that is enforced here, against the database, and not in the
 * action handler — an action that trusts the ids it was handed would let any
 * signed-in user vouch on behalf of anyone else in their village.
 */

import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";

/** Circles the user belongs to, with member names. */
export async function listMyCircles(userId: string) {
  const memberships = await prisma.circleMember.findMany({
    where: { userId },
    include: {
      circle: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    role: membership.role,
    joinedAt: membership.joinedAt,
    circle: {
      id: membership.circle.id,
      name: membership.circle.name,
      village: membership.circle.village,
      members: membership.circle.members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        role: member.role,
        isMe: member.user.id === userId,
      })),
    },
  }));
}

/** Circles in the user's village that they are not yet a member of. */
export async function listJoinableCircles(userId: string, village: string) {
  const membership = await prisma.circleMember.findMany({
    where: { userId },
    select: { circleId: true },
  });

  const joined = new Set(membership.map((m) => m.circleId));

  const circles = await prisma.trustCircle.findMany({
    where: {
      village: { equals: village.trim(), mode: "insensitive" },
      ...(joined.size ? { id: { notIn: [...joined] } } : {}),
    },
    include: {
      members: { select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return circles.map((c) => ({
    id: c.id,
    name: c.name,
    village: c.village,
    memberCount: c.members.length,
  }));
}

export type CircleActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

export async function createCircle(input: {
  userId: string;
  name: string;
  village: string;
}): Promise<CircleActionResult<{ circleId: string }>> {
  const circle = await prisma.trustCircle.create({
    data: {
      name: input.name,
      village: input.village,
      members: {
        create: { userId: input.userId, role: "ADMIN" },
      },
    },
    select: { id: true },
  });

  return { ok: true, value: { circleId: circle.id } };
}

export async function joinCircle(input: {
  userId: string;
  circleId: string;
}): Promise<CircleActionResult<{ circleId: string }>> {
  const existing = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId: input.circleId, userId: input.userId } },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, code: "already_member", message: "You are already in that circle." };
  }

  await prisma.circleMember.create({
    data: { circleId: input.circleId, userId: input.userId },
  });

  return { ok: true, value: { circleId: input.circleId } };
}

/**
 * Vouches for another member of a circle.
 *
 * Every guard below reads the database rather than trusting the caller, because
 * the circleId and toUserId arrive from a form and a tampered request is the
 * obvious attack here.
 */
export async function vouchForMember(input: {
  fromUserId: string;
  circleId: string;
  toUserId: string;
  weight: number;
  note?: string;
}): Promise<CircleActionResult> {
  if (input.fromUserId === input.toUserId) {
    return {
      ok: false,
      code: "self_vouch",
      message: "You cannot vouch for yourself.",
    };
  }

  // Both people must be members of this circle, and the voucher must be too.
  const memberships = await prisma.circleMember.findMany({
    where: {
      circleId: input.circleId,
      userId: { in: [input.fromUserId, input.toUserId] },
    },
    select: { userId: true },
  });

  if (memberships.length !== 2) {
    return {
      ok: false,
      code: "not_members",
      message: "You can only vouch for someone in the same circle as you.",
    };
  }

  try {
    await prisma.circleVouch.create({
      data: {
        circleId: input.circleId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        weight: input.weight,
        note: input.note,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        ok: false,
        code: "already_vouched",
        message: "You have already vouched for that person in this circle.",
      };
    }
    throw error;
  }

  return { ok: true, value: undefined };
}

/** Vouches given and received by a user, with names. */
export async function listVouches(userId: string) {
  const [given, received] = await Promise.all([
    prisma.circleVouch.findMany({
      where: { fromUserId: userId },
      include: { toUser: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.circleVouch.findMany({
      where: { toUserId: userId },
      include: { fromUser: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    given: given.map((v) => ({
      id: v.id,
      toName: v.toUser.name,
      weight: v.weight,
      circleId: v.circleId,
    })),
    received: received.map((v) => ({
      id: v.id,
      fromName: v.fromUser.name,
      weight: v.weight,
      circleId: v.circleId,
    })),
  };
}

// ---------------------------------------------------------------------------
// Family groups
// ---------------------------------------------------------------------------

const INVITE_TTL_DAYS = 7;

/** Groups the user owns or belongs to, with member names. */
export async function listMyFamilyGroups(userId: string) {
  const [owned, memberOf] = await Promise.all([
    prisma.familyGroup.findMany({
      where: { ownerId: userId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        },
        invitations: {
          where: { acceptedAt: null },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.familyMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            owner: { select: { id: true, name: true } },
            members: { select: { id: true, canSpend: true } },
          },
        },
      },
    }),
  ]);

  return {
    owned: owned.map((group) => ({
      id: group.id,
      name: group.name,
      isOwner: true,
      members: group.members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        canSpend: member.canSpend,
        isMe: member.user.id === userId,
      })),
      pendingInvites: group.invitations.map((invitation) => ({
        id: invitation.id,
        phone: invitation.phone,
        expiresAt: invitation.expiresAt,
      })),
    })),
    memberOf: memberOf.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
      isOwner: false,
      ownerName: membership.group.owner.name,
      canSpend: membership.canSpend,
      myMembershipId: membership.id,
    })),
  };
}

export async function createFamilyGroup(input: {
  userId: string;
  name: string;
}): Promise<CircleActionResult<{ groupId: string }>> {
  const group = await prisma.familyGroup.create({
    data: { name: input.name, ownerId: input.userId },
    select: { id: true },
  });

  return { ok: true, value: { groupId: group.id } };
}

/** SHA-256 digest, used so the raw invite token is never stored. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedInvite {
  groupId: string;
  phone: string;
  expiresAt: Date;
  /** Raw token, returned exactly once for the inviter to share. */
  token: string;
}

export async function inviteFamilyMember(input: {
  ownerUserId: string;
  groupId: string;
  phone: string;
  canSpend: boolean;
}): Promise<CircleActionResult<CreatedInvite>> {
  // Ownership is read from the database. A groupId arriving from a form is not
  // evidence that the caller is the group's owner.
  const group = await prisma.familyGroup.findFirst({
    where: { id: input.groupId, ownerId: input.ownerUserId },
    select: { id: true },
  });

  if (!group) {
    return {
      ok: false,
      code: "not_owner",
      message: "Only the account holder can invite people to this group.",
    };
  }

  // An invite to a phone number that is already a member is pointless, so it is
  // rejected rather than creating a second usable link.
  const existing = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: { id: true },
  });

  if (existing) {
    const alreadyMember = await prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: existing.id } },
      select: { id: true },
    });

    if (alreadyMember) {
      return {
        ok: false,
        code: "already_member",
        message: "That person is already in this group.",
      };
    }
  }

  const token = randomBytes(32).toString("hex");

  const invitation = await prisma.familyInvitation.create({
    data: {
      groupId: group.id,
      phone: input.phone,
      canSpend: input.canSpend,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
    },
    select: { id: true, expiresAt: true },
  });



  return {
    ok: true,
    value: {
      groupId: group.id,
      phone: input.phone,
      expiresAt: invitation.expiresAt,
      token,
    },
  };
}

/** Looks up an invitation by its raw token, without accepting it. */
export async function findInviteByToken(token: string) {
  const invitation = await prisma.familyInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      group: { select: { id: true, name: true, ownerId: true } },
    },
  });

  if (!invitation) return null;

  const now = new Date();

  return {
    id: invitation.id,
    phone: invitation.phone,
    canSpend: invitation.canSpend,
    groupId: invitation.group.id,
    groupName: invitation.group.name,
    ownerId: invitation.group.ownerId,
    accepted: invitation.acceptedAt !== null,
    expired: invitation.expiresAt <= now,
  };
}

export async function acceptInvite(input: {
  userId: string;
  token: string;
}): Promise<CircleActionResult<{ groupId: string; groupName: string }>> {
  const invitation = await prisma.familyInvitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { group: { select: { id: true, name: true, ownerId: true } } },
  });

  if (!invitation) {
    return { ok: false, code: "invalid", message: "That invite link is not valid." };
  }

  if (invitation.acceptedAt) {
    return {
      ok: false,
      code: "used",
      message: " That invite has already been used.",
    };
  }

  if (invitation.expiresAt <= new Date()) {
    return { ok: false, code: "expired", message: "That invite has expired. Ask for a new one." };
  }

  if (invitation.group.ownerId === input.userId) {
    return { ok: false, code: "owner", message: "You already own that group." };
  }

  const already = await prisma.familyMember.findUnique({
    where: { groupId_userId: { groupId: invitation.groupId, userId: input.userId } },
    select: { id: true },
  });

  if (already) {
    return {
      ok: false,
      code: "already_member",
      message: "You are already in that group.",
    };
  }

  await prisma.$transaction([
    prisma.familyMember.create({
      data: {
        groupId: invitation.groupId,
        userId: input.userId,
        canSpend: invitation.canSpend,
      },
    }),
    prisma.familyInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return {
    ok: true,
    value: { groupId: invitation.group.id, groupName: invitation.group.name },
  };
}

export async function setMemberSpendPermission(input: {
  ownerUserId: string;
  groupId: string;
  membershipId: string;
  canSpend: boolean;
}): Promise<CircleActionResult> {
  const group = await prisma.familyGroup.findFirst({
    where: { id: input.groupId, ownerId: input.ownerUserId },
    select: { id: true },
  });

  if (!group) {
    return { ok: false, code: "not_owner", message: "Only the account holder can change this." };
  }

  // The membership must belong to the group, or an id from a form could change
  // another group's member.
  const result = await prisma.familyMember.updateMany({
    where: { id: input.membershipId, groupId: group.id },
    data: { canSpend: input.canSpend },
  });

  if (result.count === 0) {
    return { ok: false, code: "not_found", message: "We could not find that member." };
  }

  return { ok: true, value: undefined };
}

export async function removeFamilyMember(input: {
  ownerUserId: string;
  groupId: string;
  membershipId: string;
}): Promise<CircleActionResult> {
  const group = await prisma.familyGroup.findFirst({
    where: { id: input.groupId, ownerId: input.ownerUserId },
    select: { id: true },
  });

  if (!group) {
    return { ok: false, code: "not_owner", message: "Only the account holder can remove people." };
  }

  await prisma.familyMember.deleteMany({
    where: { id: input.membershipId, groupId: group.id },
  });

  return { ok: true, value: undefined };
}

export async function leaveFamilyGroup(input: {
  userId: string;
  groupId: string;
}): Promise<CircleActionResult> {
  const result = await prisma.familyMember.deleteMany({
    where: { groupId: input.groupId, userId: input.userId },
  });

  if (result.count === 0) {
    return { ok: false, code: "not_member", message: "You are not in that group." };
  }

  return { ok: true, value: undefined };
}


