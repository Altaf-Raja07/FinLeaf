/**
 * Route classification.
 *
 * Kept separate from `proxy.ts` so the same classification can be reused by
 * tests and by the `requireSession` helper without importing the proxy module
 * (which is special-cased by the bundler).
 */

/**
 * Paths that require a signed-in user.
 *
 * Everything under `/dashboard`, `/profile` and `/admin`. The home page and the
 * marketing pages are public, which is what makes the project demonstrable to a
 * reviewer who has not signed up.
 */
export function isAuthedPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

/** Paths only an administrator may reach. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** The public entry paths. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/about" ||
    pathname.startsWith("/about/") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/invite" ||
    pathname === "/features" ||
    pathname.startsWith("/features/") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/methodology")
  );
}
