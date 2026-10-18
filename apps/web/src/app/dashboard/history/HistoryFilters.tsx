"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useTransition } from "react";
import { Button, Field } from "@/components/ui";
import { translate, type Locale } from "@/lib/i18n";

/**
 * History filters.
 *
 * Filters live in the URL, so the form pushes query parameters rather than
 * holding state. That makes a filtered history shareable and reloadable, and it
 * means the server does the filtering — an account's full history is never
 * shipped to the browser to be filtered there.
 */

const CATEGORIES = [
  "GROCERIES",
  "FUEL",
  "ELECTRICITY",
  "BILL_PAYMENT",
  "RECHARGE",
  "TRAVEL_PUBLIC",
  "TRAVEL_PRIVATE",
  "DINING",
  "EDUCATION",
  "HEALTHCARE",
  "TRANSFER",
] as const;

export function HistoryFilters({
  initial,
  locale,
  flagged = false,
}: {
  initial: {
    q: string;
    category: string;
    from: string;
    to: string;
    min?: string;
    max?: string;
  };
  locale: Locale;
  /** Keeps the "unusual transactions" view applied when a filter is changed. */
  flagged?: boolean;
}) {
  const t = (key: string) => translate(locale, key);
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(formData: FormData) {
    const search = new URLSearchParams(params.toString());

    for (const key of ["q", "category", "from", "to", "min", "max"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) search.set(key, value);
      else search.delete(key);
    }
    // Any filter change returns to the first page; staying on page 7 of a new
    // filtered result is a dead end.
    search.delete("page");
    if (!flagged) search.delete("flagged");

    startTransition(() => {
      // Typed routes verify the path, and this is the history page; the query
      // string is the filter the user just changed, which cannot be a literal.
      router.push(`/dashboard/history?${search.toString()}` as Route);
    });
  }

  function reset() {
    startTransition(() => router.push("/dashboard/history"));
  }

  return (
    <form action={apply} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label={t("history.search")} htmlFor="filter-q" className="lg:col-span-2">
        <input
          id="filter-q"
          name="q"
          type="search"
          defaultValue={initial.q}
          placeholder={t("history.searchPlaceholder")}
          className="input"
        />
      </Field>

      <Field label={t("history.category")} htmlFor="filter-category">
        <select
          id="filter-category"
          name="category"
          className="input"
          defaultValue={initial.category}
        >
          <option value="">{t("history.categoryAll")}</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {translate(locale, `txCategory.${category}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("history.from")} htmlFor="filter-from">
        <input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={initial.from}
          className="input"
        />
      </Field>

      <Field label={t("history.to")} htmlFor="filter-to">
        <input
          id="filter-to"
          name="to"
          type="date"
          defaultValue={initial.to}
          className="input"
        />
      </Field>

      <Field label={t("history.minAmount")} htmlFor="filter-min">
        <input
          id="filter-min"
          name="min"
          type="number"
          inputMode="decimal"
          min="0"
          defaultValue={initial.min ?? ""}
          className="input tnum"
        />
      </Field>

      <Field label={t("history.maxAmount")} htmlFor="filter-max">
        <input
          id="filter-max"
          name="max"
          type="number"
          inputMode="decimal"
          min="0"
          defaultValue={initial.max ?? ""}
          className="input tnum"
        />
      </Field>

      <div className="flex items-end gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>
          {t("history.applyFilters")}
        </Button>
        <Button type="button" variant="ghost" onClick={reset} loading={pending}>
          {t("history.resetFilters")}
        </Button>
      </div>
    </form>
  );
}
