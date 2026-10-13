import { readFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import path from "node:path";
// Loads apps/web/.env. The Prisma CLI loads it via prisma.config.ts, but this
// script is run directly by tsx, so it does its own loading.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type TxCategory } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/crypto/hash";
import { parseCriteria } from "../src/lib/badges";

/**
 * Seed script.
 *
 * ## What this seeds
 *
 *   - the financial-literacy curriculum (lessons and quizzes, all locales),
 *   - badge definitions,
 *   - carbon offset projects,
 *   - billers,
 *   - banking agents — empty unless the operator supplies data/agents.json,
 *   - and, only when explicitly asked, one administrator account.
 *
 * ## What this deliberately does NOT seed
 *
 * No users. No accounts. No transactions. No loans. No savings goals. No
 * pre-drawn charts, no sample balance, no "demo" transaction history.
 *
 * This is the key change from the prototype stage of the project, so it is
 * worth spelling out why. A prototype that ships a seeded demo account with a
 * balance and transaction history presents invented numbers as though they were
 * account facts. The only way to see a balance is to have an account, and the
 * only way to have a transaction history is to make transactions. Anyone who
 * starts this project against a fresh database sees an empty application,
 * which is the honest answer to "does this work".
 *
 * The administrator is also opt-in. It is created only when SEED_ADMIN_PHONE
 * is set, its password is randomly generated and printed exactly once, and it
 * is never stored in plaintext or in the repository.
 */

interface BillerInput {
  slug: string;
  name: string;
  category: string;
  requiresRef?: boolean;
  refLabel?: string | null;
  refPattern?: string | null;
  translations: Record<string, string>;
}

interface AgentInput {
  name: string;
  shopName: string;
  village: string;
  phone: string;
  latitude: number;
  longitude: number;
  openHours: string;
}

interface OffsetInput {
  slug: string;
  icon: string;
  costPoints: number;
  co2ePerUnitKg: number;
  unit: string;
  methodologySource: string;
  translations: Record<string, { name: string; description: string }>;
}

interface LessonQuizInput {
  order: number;
  translations: Record<
    string,
    { question: string; options: string[]; answerIndex: number; explanation: string }
  >;
}

interface LessonInput {
  slug: string;
  category: string;
  minutes: number;
  order: number;
  translations: Record<string, { title: string; summary: string; body: string[] }>;
  quizzes: LessonQuizInput[];
}

interface BadgeInput {
  slug: string;
  icon: string;
  criteria: unknown;
  translations: Record<string, { name: string; description: string }>;
}

/**
 * The seed script manages its own client rather than importing src/lib/db.
 * db.ts is wired for the Next.js runtime (singleton on globalThis, server-only
 * guard, env validated through the app's zod schema) and a script should stand
 * on its own so it fails purely on the environment it was given.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 4,
  }),
});

async function loadJson<T>(name: string): Promise<T> {
  const file = path.join(process.cwd(), "data", name);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function seedLessons(): Promise<number> {
  const { lessons } = await loadJson<{ lessons: LessonInput[] }>("lessons.json");

  let count = 0;

  for (const lesson of lessons) {
    const quizzes = lesson.quizzes ?? [];

    const saved = await prisma.lesson.upsert({
      where: { slug: lesson.slug },
      update: {
        category: lesson.category,
        minutes: lesson.minutes,
        order: lesson.order,
        translations: lesson.translations,
        active: true,
      },
      create: {
        slug: lesson.slug,
        category: lesson.category,
        minutes: lesson.minutes,
        order: lesson.order,
        translations: lesson.translations,
        active: true,
      },
    });

    // A lesson is seeded as a unit. Quizzes are replaced, so a question deleted
    // from data/lessons.json actually disappears rather than lingering hidden.
    await prisma.quiz.deleteMany({ where: { lessonId: saved.id } });

    if (quizzes.length > 0) {
      await prisma.quiz.createMany({
        data: quizzes.map((quiz) => ({
          lessonId: saved.id,
          order: quiz.order,
          translations: quiz.translations,
        })),
      });
    }

    count += 1;
  }

  return count;
}

async function seedBadges(): Promise<number> {
  const { badges } = await loadJson<{ badges: BadgeInput[] }>("badges.json");

  let count = 0;

  for (const badge of badges) {
    const criteria = parseCriteria(badge.criteria);
    if (!criteria) {
      // A badge we cannot evaluate would sit in the database forever
      // unearnable, which is worse than not seeding it at all.
      throw new Error(
        `Badge "${badge.slug}" has criteria this build does not understand: ${JSON.stringify(badge.criteria)}`,
      );
    }

    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: {
        icon: badge.icon,
        criteria: criteria,
        translations: badge.translations,
      },
      create: {
        slug: badge.slug,
        icon: badge.icon,
        criteria,
        translations: badge.translations,
      },
    });

    count += 1;
  }

  return count;
}

async function seedOffsetProjects(): Promise<number> {
  const { projects } = await loadJson<{ projects: OffsetInput[] }>(
    "offset-projects.json",
  );

  let count = 0;

  for (const project of projects) {
    const translations = Object.fromEntries(
      Object.entries(project.translations).map(([locale, value]) => [
        locale,
        { ...value, methodologySource: project.methodologySource },
      ]),
    );

    await prisma.offsetProject.upsert({
      where: { slug: project.slug },
      update: {
        icon: project.icon,
        costPoints: project.costPoints,
        co2ePerUnitKg: project.co2ePerUnitKg,
        unit: project.unit,
        translations,
        active: true,
      },
      create: {
        slug: project.slug,
        icon: project.icon,
        costPoints: project.costPoints,
        co2ePerUnitKg: project.co2ePerUnitKg,
        unit: project.unit,
        translations,
        active: true,
      },
    });

    count += 1;
  }

  return count;
}

async function seedBillers(): Promise<number> {
  const { billers } = await loadJson<{ billers: BillerInput[] }>("billers.json");

  let count = 0;

  for (const biller of billers) {
    await prisma.biller.upsert({
      where: { slug: biller.slug },
      update: {
        name: biller.name,
        category: mapCategory(biller.category),
        requiresRef: biller.requiresRef ?? false,
        refLabel: biller.refLabel ?? null,
        refPattern: biller.refPattern ?? null,
        translations: biller.translations,
        active: true,
      },
      create: {
        slug: biller.slug,
        name: biller.name,
        category: mapCategory(biller.category),
        requiresRef: biller.requiresRef ?? false,
        refLabel: biller.refLabel ?? null,
        refPattern: biller.refPattern ?? null,
        translations: biller.translations,
        active: true,
      },
    });

    count += 1;
  }

  return count;
}

async function seedAgents(): Promise<number> {
  const { agents } = await loadJson<{ agents: AgentInput[] }>("agents.json");

  let count = 0;

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: `agent-${agent.phone}` },
      update: {
        name: agent.name,
        shopName: agent.shopName,
        village: agent.village,
        phone: agent.phone,
        latitude: agent.latitude,
        longitude: agent.longitude,
        openHours: agent.openHours,
        active: true,
      },
      create: {
        id: `agent-${agent.phone}`,
        name: agent.name,
        shopName: agent.shopName,
        village: agent.village,
        phone: agent.phone,
        latitude: agent.latitude,
        longitude: agent.longitude,
        openHours: agent.openHours,
        active: true,
      },
    });

    count += 1;
  }

  return count;
}

/** Maps the data-file category string onto the enum. */
function mapCategory(value: string): TxCategory {
  const known = [
    "GROCERIES", "FUEL", "TRAVEL_PUBLIC", "TRAVEL_PRIVATE", "ELECTRICITY",
    "DINING", "EDUCATION", "HEALTHCARE", "ELECTRONICS", "CLOTHING", "HOUSING",
    "RENT", "SALARY", "TRANSFER", "BILL_PAYMENT", "RECHARGE", "LOAN", "SAVINGS",
    "GREEN_REWARD", "OFFSET", "OTHER",
  ];
  return known.includes(value) ? (value as TxCategory) : "OTHER";
}

/**
 * Links the completion badge to its lessons.
 *
 * This is the join between the `LessonBadge` link table and the badge rules,
 * so a module-complete badge covers exactly the lessons that currently exist in
 * that category.
 */
async function linkLessonBadges(): Promise<number> {
  const { badges } = await loadJson<{ badges: BadgeInput[] }>("badges.json");

  const lessons = await prisma.lesson.findMany({
    where: { active: true },
    select: { id: true, slug: true, category: true },
  });

  let linked = 0;

  for (const badge of badges) {
    const criteria = parseCriteria(badge.criteria);
    if (!criteria) continue;

    const slugs =
      criteria.type === "category_complete"
        ? lessons.filter((l) => l.category === criteria.category).map((l) => l.slug)
        : criteria.type === "lesson_completed"
          ? [criteria.lesson]
          : [];

    if (slugs.length === 0) continue;

    const badgeRow = await prisma.badge.findUnique({
      where: { slug: badge.slug },
      select: { id: true },
    });
    if (!badgeRow) continue;

    await prisma.lessonBadge.deleteMany({ where: { badgeId: badgeRow.id } });

    for (const slug of slugs) {
      const lesson = lessons.find((l) => l.slug === slug);
      if (!lesson) continue;
      await prisma.lessonBadge.create({
        data: { lessonId: lesson.id, badgeId: badgeRow.id },
      });
      linked += 1;
    }
  }

  return linked;
}

/**
 * Creates the single optional administrator.
 *
 * The password is random and shown once. There is no default, no seeded
 * constant, and nothing written to disk. If SEED_ADMIN_PHONE is unset no
 * administrator is created and the report says so.
 */
async function seedAdmin(): Promise<string | null> {
  const phone = process.env.SEED_ADMIN_PHONE?.trim();
  if (!phone) return null;

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error(
      `SEED_ADMIN_PHONE="${phone}" is not an E.164 phone number (e.g. +919876543210)`,
    );
  }

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, role: true },
  });

  // 24 characters from a CSPRNG. Printed once; never stored recoverably.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const password = Array.from({ length: 24 }, () =>
    alphabet[randomInt(0, alphabet.length)],
  ).join("");

  if (existing) {
    await prisma.user.update({
      where: { phone },
      data: { role: "ADMIN", status: "ACTIVE", passwordHash: await hashPassword(password) },
    });
  } else {
    await prisma.user.create({
      data: {
        name: "Administrator",
        phone,
        passwordHash: await hashPassword(password),
        village: "—",
        role: "ADMIN",
        status: "ACTIVE",
        accountAgeDays: 1,
      },
    });
  }

  return password;
}

async function main(): Promise<void> {
  console.log("Seeding FinLeaf reference data.\n");

  const lessons = await seedLessons();
  console.log(`  lessons      ${lessons}`);

  const quizzes = await prisma.quiz.count();
  console.log(`  quizzes      ${quizzes}`);

  const badges = await seedBadges();
  console.log(`  badges       ${badges}`);

  const linked = await linkLessonBadges();
  console.log(`  lesson→badge ${linked}`);

  const projects = await seedOffsetProjects();
  console.log(`  offsetProj.  ${projects}`);

  const billers = await seedBillers();
  console.log(`  billers      ${billers}`);

  const agents = await seedAgents();
  console.log(
    `  agents       ${agents}${agents === 0 ? "  (operator supplies these; see data/agents.json)" : ""}`,
  );

  const adminPassword = await seedAdmin();
  console.log("  admin        " + (adminPassword ? "created" : "skipped (SEED_ADMIN_PHONE not set)"));

  const [users, accounts, transactions] = await Promise.all([
    prisma.user.count(),
    prisma.account.count(),
    prisma.transaction.count(),
  ]);

  console.log(
    `\n  users ${users} · accounts ${accounts} · transactions ${transactions}`,
  );

  if (adminPassword) {
    console.log(
      `\n  ⚠ ONE-TIME ADMINISTRATOR PASSWORD for ${process.env.SEED_ADMIN_PHONE}\n  ${adminPassword}\n  This is the only time it will be shown. Change it after signing in.\n`,
    );
  }

  console.log("Reference data seeded. No demo users or transactions were created.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("\nSeed failed:");
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
