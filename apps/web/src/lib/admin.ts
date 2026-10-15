import "server-only";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth/guard";
import { mlHealth, fetchModelMetrics } from "@/lib/ml/client";
import { checkDatabase } from "@/lib/db";
import { log } from "@/lib/env";

/**
 * Administration.
 *
 * This layer deliberately does not reset or seed anything. Everything on it
 * points at rows that already exist, because a production console with a "delete
 * all data" button is a foot-gun, and because operations that destructive have no
 * business being one click away from a search field.
 *
 * ## Why every write re-checks the role
 *
 * The admin page and the admin API check the caller with `requireAdmin()`. That
 * is not enough on its own, because the console's buttons call **server
 * actions**, which are POST endpoints a signed-in user can invoke directly
 * without ever loading the page. A role check that lives only in the page is
 * decoration. Every function here that can affect another account therefore
 * re-reads the actor's role from the database first.
 */

/** Confirms the acting user is a live administrator, or throws a 403. */
async function assertAdminActor(adminId: string): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true, status: true },
  });

  if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE") {
    throw new AuthError(403, "Administrator access required", "forbidden");
  }
}

export interface AdminUserRow {
  id: string;
  name: string;
  phone: string;
  village: string;
  status: string;
  role: string;
  trustScore: number;
  greenPoints: number;
  createdAt: Date;
}

export async function listUsers(
  options: { query?: string; village?: string; limit?: number } = {},
): Promise<AdminUserRow[]> {
  const q = options.query?.trim();

  const users = await prisma.user.findMany({
    where: {
      ...(options.village ? { village: { equals: options.village.trim(), mode: "insensitive" as const } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              // Digits only, so "+91" and spacing differences cannot hide a
              // user from a search.
              { phone: { contains: q.replace(/\D/g, "") || q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
    select: {
      id: true,
      name: true,
      phone: true,
      village: true,
      status: true,
      role: true,
      trustScore: true,
      greenPoints: true,
      createdAt: true,
    },
  });

  return users;
}

export async function updateUser(input: {
  adminId: string;
  userId: string;
  status?: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "CLOSED";
  role?: "USER" | "ADMIN";
}): Promise<{ ok: boolean; message?: string }> {
  await assertAdminActor(input.adminId);

  // An administrator cannot change their own role or status. Self-service here
  // would let one compromised account escalate to permanent.
  if (input.userId === input.adminId) {
    return {
      ok: false,
      message: "You cannot change your own role or status.",
    };
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.role ? { role: input.role } : {}),
    },
  });

  await recordAdminAudit({
    adminId: input.adminId,
    action: "ADMIN_ACTION",
    detail: { target: input.userId, status: input.status, role: input.role },
  });

  return { ok: true };
}

export interface AdminFlagRow {
  id: string;
  score: number;
  reasons: unknown;
  resolved: boolean;
  createdAt: Date;
  userId: string;
  userName: string;
  transactionReference: string;
  amount: string;
}

export async function listUnresolvedFlags(limit = 50): Promise<AdminFlagRow[]> {
  const flags = await prisma.anomalyFlag.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { name: true } },
      transaction: { select: { reference: true, amount: true } },
    },
  });

  return flags.map((flag) => ({
    id: flag.id,
    score: flag.score,
    reasons: flag.reasons,
    resolved: flag.resolved,
    createdAt: flag.createdAt,
    userId: flag.userId,
    userName: flag.user.name,
    transactionReference: flag.transaction.reference,
    amount: flag.transaction.amount.toString(),
  }));
}

/**
 * Marks a flag reviewed.
 *
 * The transaction it refers to is never blocked or reversed: the flag is a note
 * for the account holder to confirm, and an administrator marking it reviewed
 * does not change what the user sees.
 */
export async function resolveFlag(input: {
  adminId: string;
  flagId: string;
}): Promise<void> {
  await assertAdminActor(input.adminId);

  const flag = await prisma.anomalyFlag.update({
    where: { id: input.flagId },
    data: { resolved: true, resolvedAt: new Date() },
    select: { userId: true },
  });

  await recordAdminAudit({
    adminId: input.adminId,
    action: "ANOMALY_REVIEWED",
    detail: { flagId: input.flagId, userId: flag.userId },
  });
}

// ---------------------------------------------------------------------------
// Agent directory
// ---------------------------------------------------------------------------

export interface AdminAgentRow {
  id: string;
  name: string;
  shopName: string;
  village: string;
  phone: string;
  openHours: string;
  active: boolean;
}

/**
 * Every agent, active or not.
 *
 * The public locator filters to `active: true`; an operator needs to see the
 * whole directory, including entries they have deactivated, to be able to audit
 * what was once published.
 */
export async function listAgentsForAdmin(): Promise<AdminAgentRow[]> {
  const rows = await prisma.agent.findMany({
    orderBy: [{ active: "desc" }, { village: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      shopName: true,
      village: true,
      phone: true,
      openHours: true,
      active: true,
    },
  });

  return rows;
}

/**
 * Adds an agent to the published directory.
 *
 * The input must already be validated by the caller — the server action or the
 * API route — because the shape of an agent record (a real phone number in
 * E.164, coordinates inside their actual ranges) is what the validation layer
 * exists for.
 */
export async function createAgentAsAdmin(
  adminId: string,
  input: {
    name: string;
    shopName: string;
    village: string;
    phone: string;
    latitude: number;
    longitude: number;
    openHours: string;
  },
): Promise<AdminAgentRow> {
  await assertAdminActor(adminId);

  const { createAgent } = await import("@/lib/agents");
  const agent = await createAgent(input);

  await recordAdminAudit({
    adminId,
    action: "ADMIN_ACTION",
    detail: { createdAgent: agent.id, village: agent.village },
  });

  return {
    id: agent.id,
    name: agent.name,
    shopName: agent.shopName,
    village: agent.village,
    phone: agent.phone,
    openHours: agent.openHours,
    active: true,
  };
}

/**
 * Removes an agent from the published directory.
 *
 * Deactivation rather than deletion: a phone number that was once published
 * cannot be un-published, and keeping the row means the audit trail can still
 * name the record that was live.
 */
export async function deactivateAgentAsAdmin(
  adminId: string,
  agentId: string,
): Promise<void> {
  await assertAdminActor(adminId);

  const { deactivateAgent } = await import("@/lib/agents");
  await deactivateAgent(agentId);

  await recordAdminAudit({
    adminId,
    action: "ADMIN_ACTION",
    detail: { deactivatedAgent: agentId },
  });
}

export interface SystemHealth {
  database: boolean;
  ml: boolean;
}

export async function systemHealth(): Promise<SystemHealth> {
  const [database, ml] = await Promise.all([checkDatabase(), mlHealth()]);
  return { database, ml };
}

export interface ModelMetricsSection {
  accuracy: number;
  precision: number;
  recall: number;
  auc_roc: number;
}

export interface ModelMetricsView {
  logistic_regression: ModelMetricsSection;
  gradient_boosting: ModelMetricsSection;
  anomaly_detector: Record<string, number | string>;
  trained_on?: string;
}

/**
 * Model metrics, or null when the service is unreachable.
 *
 * Null rather than an invented figure: the admin screen has to be able to say
 * "the ML service is down" and mean it. Copying the last-known numbers into that
 * state would be exactly the fabricated-metric behaviour the project is trying
 * to avoid.
 */
export async function modelMetrics(): Promise<ModelMetricsView | null> {
  const metrics = await fetchModelMetrics();

  if (!metrics) return null;

  // ModelMetrics is structurally compatible but its sections are loose records;
  // the cast is the honest way to narrow them without a runtime parse.
  return metrics as unknown as ModelMetricsView;
}

export async function listAuditLogs(limit = 50) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
}

async function recordAdminAudit(event: {
  adminId: string;
  action: "ADMIN_ACTION" | "ANOMALY_REVIEWED";
  detail: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: event.adminId,
        action: event.action,
        detail: event.detail as object,
      },
    });
  } catch (error) {
    log("error", "failed to record admin audit", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
