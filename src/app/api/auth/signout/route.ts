import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";
import { redirectUrl } from "@/lib/redirect";

/**
 * Sign out.
 *
 * Deletes the session row, not just the cookie, so the token is dead server-side
 * too. A cookie-only logout leaves a usable session in the database.
 */
export async function POST(request: Request) {
  await destroySession();
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.redirect(redirectUrl(request.url, "/login"), { status: 303 });
}