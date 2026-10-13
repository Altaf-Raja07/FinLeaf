"use client";

import { useTransition } from "react";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { setLocale } from "./locale-actions";

/**
 * Language switcher.
 *
 * Writes the locale cookie through a Server Action rather than client state so
 * the whole tree re-renders in the new language on the next navigation. There
 * is no route change: the URL is what a low-literacy user has to remember, so
 * switching language must not move them to a different address.
 */

export function LanguageSwitcher({
  activeLocale,
  labels,
}: {
  activeLocale: Locale;
  labels: { title: string; ariaLabel: string };
}) {
  const [pending, startTransition] = useTransition();

  async function switchLocale(next: Locale) {
    if (next === activeLocale) return;
    startTransition(async () => {
      // The Server Action writes the cookie and calls `refresh()` itself, so the
      // whole tree re-renders in the new language without a navigation.
      await setLocale(next);
    });
  }

  return (
    <div
      role="group"
      aria-label={labels.ariaLabel}
      className="flex items-center gap-1 rounded-full bg-surface-sunken p-1"
    >
      {LOCALES.map((locale) => {
        const isActive = locale === activeLocale;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => switchLocale(locale)}
            disabled={pending}
            aria-pressed={isActive}
            // The active language is marked with `aria-pressed` rather than by
            // colour alone, which matters for low-vision users.
            className={`h-8 rounded-full px-3 text-xs font-bold transition-colors disabled:opacity-60 ${
              isActive
                ? "bg-leaf-700 text-white"
                : "text-ink-soft hover:bg-surface-raised"
            }`}
          >
            {LOCALE_NAMES[locale]}
          </button>
        );
      })}
    </div>
  );
}
