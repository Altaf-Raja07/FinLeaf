import { requireUser } from "@/lib/auth/guard";
import { clearSessionCookie, destroySession } from "@/lib/auth/session";
import { ok, handleRoute } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

/**
 * Sign-out.
 *
 * Revokes the specific session rather than merely clearing the cookie, so a
 * token that was copied before sign-out cannot be replayed.
 */

export const POST = handleRoute(async () => {
  const user = await requireUser();
  await destroySession();
  await clearSessionCookie();
  await recordAudit({ userId: user.id, action: "SIGN_OUT" });
  return ok({ ok: true });
});

export function GET() {
  // Reached by a user navigating to /api/auth/logout directly. Sign-out is a
  // state change, so a GET must not perform it; redirect instead.
  return Response.redirect(new URL("/dashboard/profile", process.env.APP_URL ?? "http://localhost:3000"));
}
