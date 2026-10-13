import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { log } from "@/lib/env";
import type { AuditAction } from "@/generated/prisma/enums";

/**
 * Append-only audit trail.
 *
 * Security-relevant and money-relevant events are recorded here so an
 * administrator can answer "who moved money, when, and was it flagged" after
 * the fact. Writes never throw into the caller: an audit failure must not
 * roll back a transaction that already committed, so it is logged instead.
 *
 * Never place credentials, OTPs or raw tokens in `detail`.
 */

export interface AuditEvent {
  userId?: string | null;
  action: AuditAction;
  detail?: Record<string, unknown>;
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const h = await headers();

    await prisma.auditLog.create({
      data: {
        userId: event.userId ?? null,
        action: event.action,
        detail: (event.detail ?? undefined) as never,
        ip:
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          h.get("x-real-ip") ??
          null,
        userAgent: h.get("user-agent")?.slice(0, 256) ?? null,
      },
    });
  } catch (error) {
    log("error", "failed to write audit log", {
      action: event.action,
      userId: event.userId ?? null,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
