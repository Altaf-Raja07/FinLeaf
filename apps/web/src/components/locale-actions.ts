"use server";

import { refresh } from "next/cache";
import { setRequestLocale } from "@/lib/locale";
import type { Locale } from "@/lib/i18n";

/**
 * Switches the interface language.
 *
 * Writes the preference cookie and then calls `refresh()`, which re-fetches the
 * current route's RSC payload. That is why switching language does not change
 * the URL: the users of this product often share a device and cannot be asked
 * to learn a second address for the same page.
 *
 * `refresh()` is Server-Action-only, which is exactly where this is called
 * from — it cannot be triggered from a client event handler directly.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (locale !== "en" && locale !== "hi" && locale !== "kn") {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  await setRequestLocale(locale);
  refresh();
}
