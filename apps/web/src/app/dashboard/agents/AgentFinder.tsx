"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button, Field } from "@/components/ui";

/**
 * Agent search.
 *
 * Filters go into the URL rather than component state, so a search is shareable
 * and survives a reload.
 *
 * No geolocation is requested. A "sort by distance" toggle would need it, and a
 * page whose content may legitimately be an empty directory has no reason to ask
 * for a location before it has anything to show.
 */
export function AgentFinder({
  initialQuery,
  initialVillage,
}: {
  initialQuery: string;
  initialVillage: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function submit(formData: FormData) {
    const search = new URLSearchParams(params.toString());

    for (const key of ["q", "village"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) search.set(key, value);
      else search.delete(key);
    }

    router.push(`${pathname}?${search.toString()}`);
  }

  return (
    <form
      action={submit}
      className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
    >
      <Field
        label="Search by shop, agent or village"
        htmlFor="agents-q"
      >
        <input
          id="agents-q"
          name="q"
          type="search"
          defaultValue={initialQuery}
          className="input"
        />
      </Field>

      <Field label="Village" htmlFor="agents-village">
        <input
          id="agents-village"
          name="village"
          type="text"
          defaultValue={initialVillage}
          className="input"
        />
      </Field>

      <Button type="submit">Search</Button>
    </form>
  );
}
