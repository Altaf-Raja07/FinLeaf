/**
 * Redirect helpers.
 *
 * Next.js 16 requires an absolute URL for `NextResponse.redirect`, so these build
 * one from the *request's own origin* rather than from anything the client
 * supplied. Doing it that way keeps the Location on the origin that set the
 * session cookie (a redirect to a different hostname looks like a signed-out
 * user) and avoids reflecting a caller-supplied host back in a header, which is
 * how open redirects happen.
 *
 * In development Next also blocks cross-origin access to `/_next` dev resources,
 * so the origin is pinned via `allowedDevOrigins` in next.config.ts.
 */

/** Reject anything that is not a plain, same-origin path. */
function safePath(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`redirect path must start with "/": ${path}`);
  }
  // "//evil.com" starts with a slash but browsers treat it as absolute.
  if (path.startsWith("//")) {
    throw new Error(`redirect path must not be protocol-relative: ${path}`);
  }
  if (path.includes("\\")) {
    throw new Error(`redirect path must not contain backslashes: ${path}`);
  }
  return path;
}

/** Absolute same-origin URL for a path, derived from the request URL. */
export function sameOrigin(requestUrl: string, path: string): string {
  const origin = new URL(requestUrl).origin;
  return new URL(safePath(path), origin).toString();
}

/**
 * Append query parameters to a path, skipping empty values.
 *
 * Returns a path; combine with `sameOrigin` for a Location value.
 */
export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(safePath(path), "http://placeholder.invalid");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

/** Convenience: same-origin redirect URL with optional query parameters. */
export function redirectUrl(
  requestUrl: string,
  path: string,
  params: Record<string, string | undefined> = {}
): string {
  return sameOrigin(requestUrl, withQuery(path, params));
}