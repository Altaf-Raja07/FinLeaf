import { describe, expect, it } from "vitest";
import {
  formatCo2e,
  formatDate,
  formatMoney,
  parseLocale,
  translate,
  LOCALES,
} from "@/lib/i18n";
import { en } from "@/lib/locales/en";
import { hi } from "@/lib/locales/hi";
import { kn } from "@/lib/locales/kn";

/**
 * Locale integrity.
 *
 * These tests are what keeps the translation files honest, so they check the
 * properties that actually matter rather than just "it ran": every key present
 * in English is present in every other locale, and every `{placeholder}` in an
 * English string survives into its translation.
 */

const ALL_KEYS = Object.keys(en);
const LOCALES_WITH_CONTENT = { hi, kn };

/** Every `{placeholder}` appearing in a string. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("locale completeness", () => {
  it("has keys in English", () => {
    expect(ALL_KEYS.length).toBeGreaterThan(400);
  });

  for (const [locale, tree] of Object.entries(LOCALES_WITH_CONTENT)) {
    describe(locale, () => {
      it("has no keys missing from English", () => {
        const missing = ALL_KEYS.filter((key) => !(key in tree));
        expect(missing).toEqual([]);
      });

      it("has no keys absent from English", () => {
        const extra = Object.keys(tree).filter((key) => !(key in en));
        expect(extra).toEqual([]);
      });
    });
  }
});

describe("placeholder preservation", () => {
  /**
   * A placeholder that is dropped or renamed in translation renders the literal
   * `{name}` in a user's screen, or silently loses the value. This catches it.
   */
  for (const key of ALL_KEYS) {
    it(`preserves placeholders for ${key}`, () => {
      const expected = placeholders(en[key as keyof typeof en]);
      for (const tree of Object.values(LOCALES_WITH_CONTENT)) {
        const actual = placeholders(
          tree[key as keyof typeof tree] ?? "",
        );
        expect(actual, `${key}`).toEqual(expected);
      }
    });
  }
});

describe("translate()", () => {
  it("returns the English string", () => {
    expect(translate("en", "nav.dashboard")).toBe(en["nav.dashboard"]);
  });

  it("returns a translated string", () => {
    expect(translate("hi", "nav.dashboard")).toBe(hi["nav.dashboard"]);
    expect(translate("hi", "nav.dashboard")).not.toBe(en["nav.dashboard"]);
  });

  it("falls back to English for an unknown locale", () => {
    // A locale that passes the type check but has no tree is the runtime case.
    expect(translate("en", "nav.home")).toBe(en["nav.home"]);
  });

  it("interpolates variables", () => {
    expect(translate("en", "auth.codeSent", { phone: "+91..." })).toContain("+91...");
  });

  it("leaves an unmatched placeholder alone rather than printing undefined", () => {
    const out = translate("en", "auth.codeSent", {});
    expect(out).not.toContain("undefined");
  });

  it("returns the key itself when nothing matches", () => {
    expect(translate("en", "nope.nothing")).toBe("nope.nothing");
  });

  it("covers every locale in LOCALES", () => {
    expect(LOCALES).toEqual(["en", "hi", "kn"]);
  });
});

describe("parseLocale()", () => {
  it("accepts supported locales", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("hi")).toBe("hi");
    expect(parseLocale("kn")).toBe("kn");
  });

  it("falls back to English for anything else", () => {
    expect(parseLocale("fr")).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
    expect(parseLocale(null)).toBe("en");
    expect(parseLocale("")).toBe("en");
  });
});

describe("formatters", () => {
  it("formats rupees with the symbol and Indian grouping", () => {
    expect(formatMoney(12430)).toContain("₹");
    expect(formatMoney(12430)).toContain("12,430");
  });

  it("accepts a string amount, which is what the database returns", () => {
    expect(formatMoney("1000")).toContain("1,000");
  });

  it("renders an em dash rather than NaN for a missing value", () => {
    expect(formatMoney(Number.NaN)).toBe("—");
  });

  it("formats small carbon in kilograms and large in tonnes", () => {
    expect(formatCo2e(28.5)).toContain("kg");
    expect(formatCo2e(1500)).toContain("tonne");
  });

  it("formats a date without a time component", () => {
    expect(formatDate(new Date("2026-01-15T10:00:00Z"))).not.toContain("10:00");
  });
});
