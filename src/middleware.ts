import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers, applied to every response.
 *
 * The substantive one is the Content-Security-Policy. This app renders
 * user-supplied text (merchant names, loan purposes, notes) and accepts dictation
 * through the browser's speech API, so the policy is an explicit allow-list rather
 * than a permissive one.
 *
 * Script-src uses a per-request nonce rather than 'unsafe-inline'. Next reads the
 * nonce from the request header we set here and stamps it onto its own bootstrap
 * scripts, which means an injected <script> without the nonce cannot execute. The
 * usual reason people fall back to 'unsafe-inline' is that Next's dev overlay
 * needs it; that only applies in development, so the strict policy is used in
 * production and the dev build relaxes just that directive.
 */
export function middleware(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";

  // Next picks this up and propagates it to the scripts it renders.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isProduction ? "" : " 'unsafe-eval'"
    }`,
    // Styles are inline: Tailwind emits a <style> block and Next injects critical
    // CSS inline. This directive protects script execution, not styling, so the
    // relaxation here does not reopen the XSS path.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // The ML service is called server-side only and is never reachable from the browser.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  // `strict-dynamic` lets scripts loaded by a nonced script load further scripts,
  // which is how Next's chunk loading works without enumerating every file.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", cspHeader);

  // Defence in depth for the session cookie. The cookie is httpOnly and
  // SameSite=Lax already; these mean a script injection still cannot exfiltrate it.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Permissions-Policy",
    // Microphone is deliberately absent: nothing here records audio, and dictation
    // runs through the browser's own speech implementation.
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
  );

  if (isProduction) {
    // TLS-only. Not set in development, where a wrong value would make the app
    // unreachable over plain HTTP.
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return response;
}

export const config = {
  /**
   * Skip static assets: they are served straight from the CDN layer and gain
   * nothing from these headers.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|assets/|.*\\.(?:png|webp|svg|ico)$).*)"],
};