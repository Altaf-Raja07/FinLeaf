/**
 * Internationalisation.
 *
 * ## Approach
 *
 * Flat dot-separated keys over three locales (en, hi, kn), with English as the
 * source of truth. The active locale comes from the `NEXT_LOCALE` cookie so the
 * interface can be switched without a route change, and falls back to the
 * configured default when the cookie is absent or holds an unsupported value.
 *
 * Missing keys fall back to the English string rather than rendering the key
 * itself, so an incomplete translation shows readable text instead of leaking
 * scaffolding into a user's screen. That behaviour is deliberate and is covered
 * by a test.
 *
 * A full locale routing setup (path-prefixed languages) was considered and
 * rejected: the users of this product are low-literacy and share devices, so a
 * language switch has to be a one-tap control that does not change the URL a
 * user has to remember.
 */

export const LOCALES = ["en", "hi", "kn"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
};

import { en } from "./locales/en";
import { hi } from "./locales/hi";
import { kn } from "./locales/kn";

export const DEFAULT_LOCALE: Locale = "en";

/**
 * The shape every locale must implement: the same keys as `en`, each holding a
 * string.
 *
 * Deliberately a mapped type rather than `typeof en`, which would require every
 * locale to carry the English *literals* and therefore make any translated
 * value a type error. This way a missing key is still caught, and a translated
 * value is allowed.
 */
export type TranslationTree = { [K in keyof typeof en]: string };

const translations: Record<Locale, TranslationTree> = {
  en,
  hi: hi as TranslationTree,
  kn: kn as TranslationTree,
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: unknown): Locale {
  if (isSupportedLocale(value)) return value;
  return DEFAULT_LOCALE;
}

/**
 * Resolves a translation.
 *
 * Keys are stored flat — `"auth.codeSent"` is a literal object key rather than
 * a nested `auth` → `codeSent` path — so the lookup is a single property access
 * before falling back to a dotted walk. Flat keys survive being re-ordered by a
 * translation tool and cannot collide with a key that happens to contain a dot.
 *
 * Missing keys fall back to English, and only then to the key itself. That
 * ordering means an incomplete translation shows readable text rather than
 * leaking a key into someone's screen.
 */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const tree = translations[locale] ?? translations[DEFAULT_LOCALE];
  const fallback = translations[DEFAULT_LOCALE];

  const direct = readKey(tree, key) ?? readKey(fallback, key);
  if (direct === undefined) return key;

  if (!vars) return direct;

  return direct.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Reads a key, accepting both the flat form ("nav.home") and a dotted walk
 * ("nav" → "home") so a translation file may use either convention.
 */
function readKey(tree: Record<string, unknown>, key: string): string | undefined {
  if (typeof tree[key] === "string") return tree[key] as string;

  const walked = key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      tree,
    );

  return typeof walked === "string" ? walked : undefined;
}

/** Locale-aware money formatting. Rupees, Indian digit grouping. */
export function formatMoney(amount: string | number, currency = "INR"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Compact form for large chart values: 1,200 -> 1.2K, 1,500,000 -> 15L. */
export function formatCompactMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Short date. */
export function formatDate(value: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Short date with time, for transaction rows. */
export function formatDateTime(
  value: Date | string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Month + year, for chart axes. */
export function formatMonth(value: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale, {
    month: "short",
    year: "2-digit",
  }).format(date);
}

/** Carbon in kilograms, always labelled as an estimate. */
export function formatCo2e(kg: number, locale: Locale = DEFAULT_LOCALE): string {
  const localeStr = locale === "en" ? "en-IN" : locale;
  const number = new Intl.NumberFormat(localeStr, { maximumFractionDigits: 1 })
    .format(kg);
  if (kg >= 1000) {
    const tonnes = new Intl.NumberFormat(localeStr, { maximumFractionDigits: 2 })
      .format(kg / 1000);
    const unit = locale === "hi" ? "टन की" : locale === "kn" ? "ಟನ್ CO₂e" : "tonnes CO₂e";
    return `${tonnes} ${unit}`;
  }
  const unit = locale === "hi" ? "किग्रा CO₂e" : locale === "kn" ? "ಕೆಜಿ CO₂e" : "kg CO₂e";
  return `${number} ${unit}`;
}

export const LOCALE_COOKIE = "NEXT_LOCALE";
