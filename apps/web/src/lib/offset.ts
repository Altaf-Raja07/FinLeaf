import "server-only";
import { prisma } from "@/lib/db";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Carbon offset projects.
 *
 * The projects and their claimed carbon benefits are operator-supplied data,
 * not FinLeaf's own estimates, and every entry carries the source that
 * published its figure. Surfacing the source beside the number is deliberate:
 * a user deciding whether to spend 200 green points is entitled to see exactly
 * what the estimate rests on, and FinLeaf has not audited any of them.
 */

export interface OffsetProjectView {
  id: string;
  slug: string;
  icon: string;
  name: string;
  description: string;
  costPoints: number;
  co2ePerUnitKg: number;
  unit: string;
  methodologySource: string;
}

interface OffsetFile {
  projects: Array<{
    slug: string;
    icon: string;
    costPoints: number;
    co2ePerUnitKg: number;
    unit: string;
    methodologySource: string;
    translations: Record<string, { name: string; description: string }>;
  }>;
}

/** Locale-aware text for a project, falling back to English. */
export function localize(
  translations: Record<string, { name: string; description: string }>,
  locale: string,
): { name: string; description: string } {
  return translations[locale] ?? translations.en;
}

export async function listOffsetProjects(locale = "en"): Promise<OffsetProjectView[]> {
  // The curated file is the primary source; the database is a mirror written by
  // the seed script, so an unseeded deployment still has a working marketplace.
  const file = path.join(process.cwd(), "data", "offset-projects.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as OffsetFile;

  return parsed.projects.map((project) => {
    const text = localize(project.translations, locale);
    return {
      id: project.slug,
      slug: project.slug,
      icon: project.icon,
      name: text.name,
      description: text.description,
      costPoints: project.costPoints,
      co2ePerUnitKg: project.co2ePerUnitKg,
      unit: project.unit,
      methodologySource: project.methodologySource,
    };
  });
}

export async function listContributions(
  userId: string,
): Promise<Record<string, number>> {
  // Units already funded, per project. Keyed by the seeded project's slug so it
  // lines up with the curated file even when the database has not been seeded.
  // Returns units per project id (which is the project slug) for the form to
  // show how much the user has already funded.
  const rows = await prisma.offsetContribution.groupBy({
    by: ["projectId"],
    where: { userId },
    _sum: { units: true, co2eKg: true },
  });

  return Object.fromEntries(
    rows.map((row) => [row.projectId, Number(row._sum.co2eKg ?? 0)]),
  );
}
