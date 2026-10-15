"use server";

import { revalidatePath } from "next/cache";
import {
  createAgentAsAdmin,
  deactivateAgentAsAdmin,
  resolveFlag,
  updateUser,
} from "@/lib/admin";
import { AuthError } from "@/lib/auth/guard";
import {
  adminAgentCreateSchema,
  adminAgentDeactivateSchema,
  adminUserUpdateSchema,
  anomalyResolveSchema,
  fieldErrors,
} from "@/lib/validation";

/**
 * Administrative actions.
 *
 * Each action identifies the caller from the session, then the `lib/admin`
 * function it calls re-reads that caller's role from the database. The second
 * check is the one that matters: a server action is a public POST endpoint, so
 * hiding the button is not an authorisation control.
 */

async function actingAdmin(): Promise<
  { ok: true; id: string } | { ok: false; message: string }
> {
  const { currentUser } = await import("@/lib/auth/session");
  const admin = await currentUser();
  if (!admin) return { ok: false, message: "Sign in." };
  return { ok: true, id: admin.id };
}

export async function updateUserAction(input: {
  userId: string;
  status?: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "CLOSED";
  role?: "USER" | "ADMIN";
}): Promise<{ ok: boolean; message?: string }> {
  const actor = await actingAdmin();
  if (!actor.ok) return { ok: false, message: actor.message };

  const parsed = adminUserUpdateSchema
    .pick({ userId: true, status: true, role: true })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid target." };

  try {
    const result = await updateUser({
      adminId: actor.id,
      userId: parsed.data.userId,
      status: parsed.data.status,
      role: parsed.data.role,
    });

    if (result.ok) revalidatePath("/admin", "page");
    return result;
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function resolveFlagAction(flagId: string): Promise<void> {
  const actor = await actingAdmin();
  if (!actor.ok) return;

  const parsed = anomalyResolveSchema.safeParse({ flagId });
  if (!parsed.success) return;

  await resolveFlag({ adminId: actor.id, flagId: parsed.data.flagId });
  revalidatePath("/admin", "page");
}

// ---------------------------------------------------------------------------
// Agent directory
// ---------------------------------------------------------------------------

export interface AgentFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

export async function createAgentAction(
  _prev: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const actor = await actingAdmin();
  if (!actor.ok) return { error: actor.message };

  const parsed = adminAgentCreateSchema.safeParse({
    name: formData.get("name"),
    shopName: formData.get("shopName"),
    village: formData.get("village"),
    phone: formData.get("phone"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    openHours: formData.get("openHours"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    const agent = await createAgentAsAdmin(actor.id, parsed.data);
    revalidatePath("/admin", "page");

    return {
      message: `${agent.name} (${agent.shopName}) added to the directory.`,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function deactivateAgentAction(agentId: string): Promise<void> {
  const actor = await actingAdmin();
  if (!actor.ok) return;

  const parsed = adminAgentDeactivateSchema.safeParse({ agentId });
  if (!parsed.success) return;

  await deactivateAgentAsAdmin(actor.id, parsed.data.agentId);
  revalidatePath("/admin", "page");
}
