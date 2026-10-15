import { requireAdmin } from "@/lib/auth/guard";
import { adminAgentCreateSchema, fieldErrors } from "@/lib/validation";
import { created, handleRoute, ok, badRequest } from "@/lib/api";
import { createAgentAsAdmin, listAgentsForAdmin } from "@/lib/admin";

/**
 * Operator API for the banking-agent directory.
 *
 * `data/agents.json` ships empty on purpose: FinLeaf will not invent agent
 * names and phone numbers, because a user looking for a place to deposit cash
 * would be sent to a stranger. The directory is loaded by the Correspondent
 * network operator — in bulk, by script, through this endpoint — once they have
 * confirmed who is authorised to accept deposits.
 *
 * Both methods require an administrator. `requireAdmin()` reads the role from
 * the database, and `createAgentAsAdmin` re-checks it, because an API route and
 * a server action are the same kind of public endpoint.
 */

export const GET = handleRoute(async () => {
  await requireAdmin();

  const agents = await listAgentsForAdmin();

  return ok({ agents, count: agents.length });
});

export const POST = handleRoute(async (request: Request) => {
  const admin = await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("The request body must be JSON.");
  }

  const parsed = adminAgentCreateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Check the highlighted fields.", fieldErrors(parsed.error));
  }

  const agent = await createAgentAsAdmin(admin.id, parsed.data);

  return created({ agent });
});
