import { NextResponse, type NextRequest } from "next/server";
import { isAuthedPath } from "@/lib/auth/routes";

/**
 * Proxy (Next.js 16's renamed middleware).
 *
 * ## What it does
 *
 * Forces the authenticated area to be authenticated. An unauthenticated request
 * for a protected path is redirected to sign-in, preserving the destination so
 * the user lands where they were going. A signed-in visitor sent to the sign-in
 * page is redirected to their dashboard instead of being shown a form they do
 * not need.
 *
 * ## What it deliberately does not do
 *
 * It is **not** an authorisation control. A proxy matches on path alone and can
 * be bypassed by calling a route handler directly, so every handler and Server
 * Function re-checks identity and role itself. See `src/lib/auth/guard.ts` and
 * `src/lib/auth/routes.ts`.
 *
 * It does not verify the session's HMAC. That needs the database, and doing it
 * here would put a query on every request including assets; the pages and
 * handlers that actually serve protected data do the real check.
 *
 * The `matcher` excludes Next's own output and static files. It is a negative
 * match so a new page is protected by default rather than leaking because
 * nobody added it to a list.
 */

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const token = request.cookies.get("finleaf_session")?.value;
  const looksSignedIn = typeof token === "string" && token.length >= 40;

  const protectedPath = isAuthedPath(pathname);
  const signInPage = pathname === "/sign-in";

  if (looksSignedIn && signInPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!protectedPath) {
    return NextResponse.next();
  }

  if (!looksSignedIn) {
    const target = new URL("/sign-in", request.url);
    // Remember where the user was going so sign-in can return them there.
    target.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|woff|woff2)).*)",
    },
  ],
};
