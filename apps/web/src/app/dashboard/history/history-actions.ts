"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { anomalyResolveSchema } from "@/lib/validation";

/**
 * User confirms an unusual transaction that was flagged by the anomaly detector.
 *
 * Verifies that the flag belongs to the authenticated user, marks it resolved,
 * and writes an audit log entry.
 */
export async function confirmAnomalyAction(flagId: string): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  const parsed = anomalyResolveSchema.safeParse({ flagId });
  if (!parsed.success) return;

  const flag = await prisma.anomalyFlag.findUnique({
    where: { id: parsed.data.flagId },
    select: { id: true, userId: true, resolved: true },
  });

  if (!flag || flag.userId !== user.id || flag.resolved) return;

  await prisma.anomalyFlag.update({
    where: { id: flag.id },
    data: {
      resolved: true,
      resolvedAt: new Date(),
    },
  });

  await recordAudit({
    userId: user.id,
    action: "ANOMALY_REVIEWED",
    detail: { flagId: flag.id, confirmedBy: "user" },
  });

  revalidatePath("/dashboard", "page");
  revalidatePath("/dashboard/history", "page");
  revalidatePath("/dashboard/notifications", "page");
}
