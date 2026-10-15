import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seed verification.
 *
 * A read-only check that every record in `data/*.json` made it into the
 * database, and nothing in the database claims to be reference data that the
 * files do not contain.
 *
 * This exists because "the containers started" is not the same claim as "the
 * reference data is present". A deployment that skipped `db:seed` serves an
 * empty curriculum and an empty biller list, which looks like a product bug
 * rather than a missing migration step. This script fails loudly instead, and
 * exits non-zero so a CI job or a compose profile can gate on it.
 *
 * Run with:  npm run smoke:seed
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 4,
  }),
});

let failures = 0;

function check(name: string, pass: boolean, detail: string | number = "") {
  if (!pass) failures += 1;
  const detailText = typeof detail === "number" ? String(detail) : detail;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detailText ? "  — " + detailText : ""}`);
}

async function loadJson<T>(name: string): Promise<T> {
  const file = path.join(process.cwd(), "data", name);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/**
 * Compares a slugs-in-file list against the slugs actually stored.
 *
 * Reports missing and unexpected separately: a missing slug means the seed did
 * not run or the file was edited without re-seeding; an unexpected slug means
 * the database has drifted from the repository, which is worth seeing even
 * though it is not an error on its own.
 */
function checkSlugs(label: string, expected: string[], actual: string[]) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  const missing = expected.filter((slug) => !actualSet.has(slug));
  const extra = actual.filter((slug) => !expectedSet.has(slug));

  check(
    label,
    missing.length === 0,
    missing.length === 0 ? `${actual.length} rows` : `missing: ${missing.join(", ")}`,
  );

  if (extra.length > 0) {
    // Not a failure: rows can exist from a previous seed of a different file
    // revision. Printed so drift is visible rather than silent.
    console.log(`      note: ${extra.length} row(s) not in data file: ${extra.slice(0, 5).join(", ")}`);
  }
}

async function main() {
  console.log("Seed verification\n");

  // --- Curriculum -------------------------------------------------------
  const { lessons } = await loadJson<{ lessons: Array<{ slug: string; quizzes?: unknown[] }> }>(
    "lessons.json",
  );
  const dbLessons = await prisma.lesson.findMany({ select: { id: true, slug: true } });
  checkSlugs("lessons", lessons.map((l) => l.slug), dbLessons.map((l) => l.slug));

  // Every lesson with a quiz in the file must still have at least one row.
  const bySlug = new Map(dbLessons.map((l) => [l.slug, l.id]));
  const quizCounts = await prisma.quiz.groupBy({
    by: ["lessonId"],
    _count: { _all: true },
  });
  const quizzesByLesson = new Map(quizCounts.map((q) => [q.lessonId, q._count._all]));

  for (const lesson of lessons) {
    const expectedQuizzes = lesson.quizzes?.length ?? 0;
    if (expectedQuizzes === 0) continue;

    const lessonId = bySlug.get(lesson.slug);
    const stored = lessonId ? (quizzesByLesson.get(lessonId) ?? 0) : 0;

    check(
      `  quizzes for ${lesson.slug}`,
      stored >= expectedQuizzes,
      `${stored}/${expectedQuizzes}`,
    );
  }

  // --- Badges -----------------------------------------------------------
  const { badges } = await loadJson<{ badges: Array<{ slug: string }> }>("badges.json");
  const dbBadges = await prisma.badge.findMany({ select: { slug: true } });
  checkSlugs("badges", badges.map((b) => b.slug), dbBadges.map((b) => b.slug));

  const lessonBadges = await prisma.lessonBadge.count();
  check("lesson to badge links", lessonBadges > 0, lessonBadges);

  // --- Offset projects --------------------------------------------------
  const { projects } = await loadJson<{ projects: Array<{ slug: string }> }>(
    "offset-projects.json",
  );
  const dbProjects = await prisma.offsetProject.findMany({ select: { slug: true } });
  checkSlugs("offset projects", projects.map((p) => p.slug), dbProjects.map((p) => p.slug));

  // --- Billers ----------------------------------------------------------
  const { billers } = await loadJson<{ billers: Array<{ slug: string }> }>("billers.json");
  const dbBillers = await prisma.biller.findMany({ select: { slug: true } });
  checkSlugs("billers", billers.map((b) => b.slug), dbBillers.map((b) => b.slug));

  // --- Agents -----------------------------------------------------------
  // Empty by design: the directory is operator-supplied, usually through
  // POST /api/admin/agents rather than the file. So the check is one-directional
  // — every agent the file lists must be in the database — and agents that are
  // only in the database are reported as a note, not a failure. A deployment
  // with a populated operator directory and an empty file is correct.
  const { agents } = await loadJson<{ agents: Array<{ phone?: string }> }>("agents.json");
  const filePhones = agents.map((agent) => agent.phone).filter(Boolean) as string[];
  const dbAgents = await prisma.agent.findMany({ select: { phone: true } });
  const dbPhones = new Set(dbAgents.map((agent) => agent.phone));

  const missingAgents = filePhones.filter((phone) => !dbPhones.has(phone));
  check(
    "agents",
    missingAgents.length === 0,
    `${filePhones.length} in file, ${dbAgents.length} in database${
      missingAgents.length ? ` — missing: ${missingAgents.join(", ")}` : ""
    }`,
  );

  // --- The honest-empty claim -------------------------------------------
  // The seed must never create users. If a fresh install shows a user here, the
  // empty-state claims in the README and the UI are wrong.
  const users = await prisma.user.count();
  if (users === 0) {
    console.log("PASS  no seeded users (database is fresh, as documented)");
  } else {
    console.log(`      note: ${users} user(s) exist — this script does not check user provenance`);
  }

  console.log(
    failures === 0
      ? "\nReference data verified. Every record in data/ is in the database."
      : `\n${failures} check(s) failed. Run \`npm run db:seed\` and try again.`,
  );

  process.exitCode = failures > 0 ? 1 : 0;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("\nVerification failed:");
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
