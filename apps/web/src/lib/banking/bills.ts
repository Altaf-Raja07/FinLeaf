import "server-only";
import { prisma } from "@/lib/db";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Bill payments and recharges.
 *
 * Master data comes from `data/billers.json`, which lists real Indian billers.
 * That file is curated rather than generated: an invented biller is not just a
 * placeholder, it is a name that could belong to a real company.
 *
 * ## What a payment here actually does
 *
 * It debits the FinLeaf account and records a receipt. It does **not** settle a
 * real utility or telecom bill — FinLeaf has no integration with any operator,
 * and the interface says so where the payment is made. Claiming otherwise would
 * be the single most damaging lie this product could tell.
 */

export interface Biller {
  slug: string;
  name: string;
  category: string;
  requiresRef: boolean;
  refLabel: string | null;
  refPattern: string | null;
  translations: Record<string, string>;
}

interface BillersFile {
  billers: Array<{
    slug: string;
    name: string;
    category: string;
    requiresRef?: boolean;
    refLabel?: string | null;
    refPattern?: string | null;
    translations: Record<string, string>;
  }>;
}

/**
 * Reads the curated biller list from disk rather than the database.
 *
 * Deliberate: this list is reference data that changes with the code, and the
 * seed script copies it into the database on demand. Reading it directly means a
 * deployment that has not run `db:seed` still has a working biller list, rather
 * than an empty one that looks like a bug.
 */
export async function loadBillers(): Promise<Biller[]> {
  const file = path.join(process.cwd(), "data", "billers.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as BillersFile;

  return parsed.billers
    .map((biller) => ({
      slug: biller.slug,
      name: biller.name,
      category: biller.category,
      requiresRef: biller.requiresRef ?? false,
      refLabel: biller.refLabel ?? null,
      refPattern: biller.refPattern ?? null,
      translations: biller.translations,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Active billers from the database, falling back to the curated file. */
export async function listBillers(): Promise<Biller[]> {
  try {
    const rows = await prisma.biller.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        slug: true,
        name: true,
        category: true,
        requiresRef: true,
        refLabel: true,
        refPattern: true,
        translations: true,
      },
    });

    if (rows.length > 0) {
      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        category: row.category,
        requiresRef: row.requiresRef,
        refLabel: row.refLabel,
        refPattern: row.refPattern,
        translations: (row.translations as Record<string, string> | null) ?? {},
      }));
    }
  } catch {
    // Fall through to the curated file rather than showing the user an empty
    // list because the database is unavailable.
  }

  return loadBillers();
}

export async function findBiller(slug: string): Promise<Biller | null> {
  const billers = await listBillers();
  return billers.find((b) => b.slug === slug) ?? null;
}

/** Translates a biller's display name for the given locale. */
export function billerLabel(biller: Biller, locale: string): string {
  return biller.translations[locale] ?? biller.name;
}

