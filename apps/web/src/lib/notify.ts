import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/env";
import type { NotificationType } from "@/generated/prisma/enums";

/**
 * In-app notifications.
 *
 * Titles and bodies are built by the caller in the user's preferred language.
 * A notification failure never blocks the action that triggered it, so writes
 * are caught and logged rather than thrown.
 */

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
}

export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
      },
    });
  } catch (error) {
    log("error", "failed to create notification", {
      userId: input.userId,
      type: input.type,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
) {
  const { limit = 20, unreadOnly = false } = options;

  return prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[],
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
