import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/lib/i18n";

/**
 * Locale resolution for a request.
 *
 * The locale lives in a cookie rather than in the URL. That is a deliberate
 * choice: the users of this product are low-literacy and often share a device,
 * so switching language has to be a one-tap control that does not change the
 * address someone has to remember or re-type.
 *
 * The cookie is intentionally readable by JavaScript (`httpOnly: false`) — it
 * carries no authority, only a preference, and client components need it to
 * render in the right language without a round trip.
 */

export type { Locale };

/** The active locale for this request, or the default when the cookie is unset. */
export async function requestLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocale(store.get(LOCALE_COOKIE)?.value);
}

/**
 * Sets the locale preference.
 *
 * Callable only from a Server Action or route handler: cookies are writable
 * only there, and the caller follows up with `redirect` or a re-render.
 */
export async function setRequestLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
