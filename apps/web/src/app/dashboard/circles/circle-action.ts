"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { createNotification } from "@/lib/notify";
import { refreshTrustScore } from "@/lib/trust";
import { log } from "@/lib/env";
import {
  circleCreateSchema,
  circleJoinSchema,
  fieldErrors,
  vouchSchema,
} from "@/lib/validation";
import type { CircleRole } from "@/generated/prisma/enums";

/**
 * Trust circles.
 *
 * A circle is the digital form of a microfinance self-help group: a handful of
 * people from the same village who vouch for each other because they already
 * know each other. Nothing here is a credit reference — FinLeaf is not a lender
 * and a vouch is not a guarantee. It is a statement that a member is who they
 * say they are.
 *
 * ## How a vouch reaches the trust score
 *
 * It does not, directly. A vouch adds no fixed number of points to anyone. The
 * only scoring channel is the `group_activity` feature, which is computed from
 * how many groups a user actually belongs to (see lib/trust). So a vouch can
 * only move a score insofar as the circle participation it represents is part
 * of that feature, and `refreshTrustScore` is what keeps the materialised score
 * current with it. The interface says this in as many words, because "vouch to
 * raise your score" is exactly the incentive this design is trying not to
 * create.
 */

const CIRCLES_PATH = "/dashboard/circles";

export interface CircleMemberView {
  userId: string;
  name: string;
  role: CircleRole;
  joinedAt: Date;
  isMe: boolean;
  /** True once I have used my single vouch for this member in this circle. */
  vouchedByMe: boolean;
}

export interface CircleView {
  id: string;
  name: string;
  village: string;
  createdAt: Date;
  members: CircleMemberView[];
  vouchesGiven: number;
  vouchesReceived: number;
}

export interface JoinableCircleView {
  id: string;
  name: string;
  village: string;
  memberCount: number;
}

export interface CirclesOverview {
  circles: CircleView[];
  joinable: JoinableCircleView[];
  vouchesGiven: number;
  vouchesReceived: number;
}

/**
 * Everything the circle page renders.
 *
 * The member list and the vouch rows are read in the same pass as the memberships,
 * because "who is in this circle" and "have I vouched for them" are one question
 * to a reader.
 */
export async function listCircles(
  userId: string,
  village: string,
): Promise<CirclesOverview> {
  const memberships = await prisma.circleMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      circle: {
        select: {
          id: true,
          name: true,
          village: true,
          createdAt: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: {
              userId: true,
              role: true,
              joinedAt: true,
              user: { select: { name: true } },
            },
          },
          vouches: { select: { fromUserId: true, toUserId: true } },
        },
      },
    },
  });

  const circles: CircleView[] = memberships.map(({ circle }) => {
    const vouches = circle.vouches;
    return {
      id: circle.id,
      name: circle.name,
      village: circle.village,
      createdAt: circle.createdAt,
      vouchesGiven: vouches.filter((v) => v.fromUserId === userId).length,
      vouchesReceived: vouches.filter((v) => v.toUserId === userId).length,
      members: circle.members.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        role: member.role,
        joinedAt: member.joinedAt,
        isMe: member.userId === userId,
        vouchedByMe: vouches.some(
          (v) => v.fromUserId === userId && v.toUserId === member.userId,
        ),
      })),
    };
  });

  // Circles in my village that I have not joined. Matching is case-insensitive
  // because the village is free text typed by the user, and "Rampur" and
  // "rampur" are the same place.
  const joinedIds = circles.map((circle) => circle.id);
  const rows = await prisma.trustCircle.findMany({
    where: {
      village: { equals: village, mode: "insensitive" },
      ...(joinedIds.length ? { id: { notIn: joinedIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      village: true,
      _count: { select: { members: true } },
    },
  });

  return {
    circles,
    joinable: rows.map((row) => ({
      id: row.id,
      name: row.name,
      village: row.village,
      memberCount: row._count.members,
    })),
    vouchesGiven: circles.reduce((sum, c) => sum + c.vouchesGiven, 0),
    vouchesReceived: circles.reduce((sum, c) => sum + c.vouchesReceived, 0),
  };
}

export interface CircleFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

/**
 * Starts a circle and puts the creator in it.
 *
 * Creating an empty circle and then joining it would let a caller invent a
 * group nobody belongs to, so the membership is written in the same statement
 * as the circle.
 */
export async function createCircleAction(
  _prev: CircleFormState,
  formData: FormData,
): Promise<CircleFormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = circleCreateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    village: String(formData.get("village") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: "Check the details above.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const circle = await prisma.trustCircle.create({
    data: {
      name: parsed.data.name,
      village: parsed.data.village,
      members: {
        create: {
          userId: user.id,
          // The schema carries MENTOR and ADMIN but nothing in the product acts
          // on them, so the founder is an ordinary member rather than a role
          // that implies authority nobody can exercise.
        },
      },
    },
    select: { id: true, name: true },
  });

  // Membership is what the `group_activity` feature counts, so joining genuinely
  // changes the score — unlike a vouch, which does not.
  await refreshTrustScore(user.id);

  revalidatePath(CIRCLES_PATH, "page");
  return { message: `Started ${circle.name}.` };
}

/**
 * Joins an existing circle.
 *
 * The circle is read back before the insert rather than trusted from the form:
 * a circle id is not evidence that the circle is in my village, and joining a
 * group somewhere else would put me in a room full of strangers.
 */
export async function joinCircleAction(
  _prev: CircleFormState,
  formData: FormData,
): Promise<CircleFormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = circleJoinSchema.safeParse({
    circleId: String(formData.get("circleId") ?? ""),
  });

  if (!parsed.success) {
    return { error: "We could not find that circle." };
  }

  const circle = await prisma.trustCircle.findUnique({
    where: { id: parsed.data.circleId },
    select: { id: true, name: true, village: true },
  });

  if (!circle) {
    return { error: "We could not find that circle." };
  }

  if (circle.village.toLowerCase() !== user.village.toLowerCase()) {
    log("info", "circle join declined: different village", {
      userId: user.id,
      circleId: circle.id,
    });
    return {
      error: "That circle is in a different village. You can only join circles where you live.",
    };
  }

  const existing = await prisma.circleMember.findUnique({
    where: {
      circleId_userId: { circleId: circle.id, userId: user.id },
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "You are already in that circle." };
  }

  await prisma.circleMember.create({
    data: { circleId: circle.id, userId: user.id },
    select: { id: true },
  });

  await refreshTrustScore(user.id);

  revalidatePath(CIRCLES_PATH, "page");
  return { message: `Joined ${circle.name}.` };
}

export interface VouchActionState {
  error?: string;
  message?: string;
}

/**
 * Vouches for one member of one circle.
 *
 * The rules, all of which are enforced here rather than in the interface:
 *
 *  1. You cannot vouch for yourself. A self-vouch is the whole attack — one
 *     person building their own reference — so it is rejected before any read.
 *  2. Both you and the other member must be in that same circle. A vouch from
 *     outside the group is not a peer reference, it is a stranger's opinion.
 *  3. One vouch per (circle, from, to). The unique index is the backstop; the
 *     read before the write is what makes the common case a clean message.
 *
 * The score is refreshed afterwards rather than adjusted by a weight, which is
 * the point: see the note at the top of this file.
 */
export async function vouchForMemberAction(
  _prev: VouchActionState,
  formData: FormData,
): Promise<VouchActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = vouchSchema.safeParse({
    circleId: String(formData.get("circleId") ?? ""),
    toUserId: String(formData.get("toUserId") ?? ""),
    weight: formData.get("weight") ? String(formData.get("weight")) : undefined,
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  if (!parsed.success) {
    return { error: "We could not record that vouch." };
  }

  const { circleId, toUserId, weight, note } = parsed.data;

  if (toUserId === user.id) {
    return { error: "You cannot vouch for yourself." };
  }

  // Membership is read for both people in one query: two matching rows is the
  // only evidence that these two are peers in this circle.
  const memberships = await prisma.circleMember.findMany({
    where: {
      circleId,
      userId: { in: [user.id, toUserId] },
    },
    select: { userId: true },
  });

  const memberIds = new Set(memberships.map((m) => m.userId));

  if (!memberIds.has(user.id) || !memberIds.has(toUserId)) {
    return {
      error: "You can only vouch for someone in a circle you are both in.",
    };
  }

  const existing = await prisma.circleVouch.findUnique({
    where: {
      circleId_fromUserId_toUserId: {
        circleId,
        fromUserId: user.id,
        toUserId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "You have already vouched for this member in this circle." };
  }

  try {
    await prisma.circleVouch.create({
      data: { circleId, fromUserId: user.id, toUserId, weight, note: note ?? null },
      select: { id: true },
    });
  } catch (error) {
    // A double-tap produces a second POST that passes the read above. The unique
    // index makes it harmless, and saying so is better than failing.
    if (isUniqueViolation(error)) {
      return { error: "You have already vouched for this member in this circle." };
    }
    throw error;
  }

  const circle = await prisma.trustCircle.findUnique({
    where: { id: circleId },
    select: { name: true },
  });

  await createNotification({
    userId: toUserId,
    type: "SYSTEM",
    title: "Someone vouched for you",
    body: circle
      ? `A member of ${circle.name} confirmed you are who you say you are.`
      : "A circle member confirmed you are who you say you are.",
    href: CIRCLES_PATH,
  });

  await refreshTrustScore(user.id);

  revalidatePath(CIRCLES_PATH, "page");
  return { message: "Vouch recorded." };
}

/** Prisma's unique-constraint error code, without importing the client runtime. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
