import "server-only";
import { prisma } from "@/lib/db";
import { evaluateBadge, parseCriteria } from "@/lib/badges";
import type { BadgeProgressInput } from "@/lib/badges";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The financial-literacy curriculum.
 *
 * Lessons, quizzes and badges live in the database, seeded from
 * data/lessons.json and data/badges.json, so they are read here rather than
 * imported straight from those files. That keeps the app and the seed script
 * working off one copy of the content, and a deployment whose database was
 * never seeded shows an honest empty curriculum instead of a hand-maintained
 * duplicate that can drift.
 *
 * `translations` is loose JSON by design. Every reader below narrows it
 * defensively and falls back to English: a lesson that has not been translated
 * yet should still render, and a row that cannot be read at all should be
 * skipped rather than throwing and taking the whole page down with it.
 */

/**
 * Green points for finishing a lesson.
 *
 * One award per lesson, on the first recorded quiz attempt, so repeating a quiz
 * cannot be farmed for points.
 */
export const POINTS_PER_LESSON = 10;

// ---------------------------------------------------------------------------
// Reading the loose translations JSON
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Reads one locale's node out of a translations column, falling back to English.
 *
 * English is the source of truth for the content files, so an untranslated
 * entry still renders rather than disappearing from the curriculum.
 */
function localized<T>(
  translations: Prisma.JsonValue,
  locale: string,
  read: (node: Record<string, unknown>) => T | null,
): T | null {
  const tree = asRecord(translations);
  if (!tree) return null;
  return read(asRecord(tree[locale]) ?? {}) ?? read(asRecord(tree.en) ?? {});
}

interface LessonText {
  title: string;
  summary: string;
  body: string[];
}

function readLessonText(node: Record<string, unknown>): LessonText | null {
  const title = typeof node.title === "string" ? node.title : null;
  if (title === null) return null;
  return {
    title,
    summary: typeof node.summary === "string" ? node.summary : "",
    body: Array.isArray(node.body)
      ? node.body.filter((line): line is string => typeof line === "string")
      : [],
  };
}

interface QuizText {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

function readQuizText(node: Record<string, unknown>): QuizText | null {
  const question = typeof node.question === "string" ? node.question : null;
  if (question === null) return null;
  const options = Array.isArray(node.options)
    ? node.options.filter((option): option is string => typeof option === "string")
    : [];
  if (options.length === 0) return null;
  return {
    question,
    options,
    answerIndex: typeof node.answerIndex === "number" ? node.answerIndex : -1,
    explanation: typeof node.explanation === "string" ? node.explanation : "",
  };
}

function readBadgeText(node: Record<string, unknown>): { name: string; description: string } | null {
  const name = typeof node.name === "string" ? node.name : null;
  if (name === null) return null;
  return {
    name,
    description: typeof node.description === "string" ? node.description : "",
  };
}

/**
 * The stored answer index for one quiz row.
 *
 * Exported for the quiz action alone: this is the answer key, so nothing that
 * reaches the browser may call it.
 */
export function quizAnswerIndex(translations: Prisma.JsonValue, locale: Locale): number | null {
  const text = localized(translations, locale, readQuizText);
  return text ? text.answerIndex : null;
}

/**
 * Category display names.
 *
 * Only the four published categories have translation keys; an unrecognised
 * category falls through as its raw value rather than rendering a dotted key.
 */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  basics: "learn.category.basics",
  saving: "learn.category.saving",
  borrowing: "learn.category.borrowing",
  fraud: "learn.category.fraud",
};

function categoryLabel(category: string, locale: Locale): string {
  const key = CATEGORY_LABEL_KEYS[category];
  return key ? translate(locale, key) : category;
}

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

export interface LessonListItem {
  slug: string;
  minutes: number;
  title: string;
  summary: string;
  questionCount: number;
  completed: boolean;
}

export interface LessonCategoryGroup {
  category: string;
  label: string;
  lessons: LessonListItem[];
  completedCount: number;
}

/** A lesson as the list page needs it. `completed` means a recorded attempt. */
export async function listLessonCategories(
  userId: string,
  locale: Locale,
): Promise<LessonCategoryGroup[]> {
  const [lessons, attempts] = await Promise.all([
    prisma.lesson.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { quizzes: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      select: { lessonId: true },
    }),
  ]);

  const attemptedLessonIds = new Set(attempts.map((attempt) => attempt.lessonId));
  const groups = new Map<string, LessonCategoryGroup>();

  for (const lesson of lessons) {
    const text = localized(lesson.translations, locale, readLessonText);
    if (!text) continue;

    let group = groups.get(lesson.category);
    if (!group) {
      group = {
        category: lesson.category,
        label: categoryLabel(lesson.category, locale),
        lessons: [],
        completedCount: 0,
      };
      groups.set(lesson.category, group);
    }

    const completed = attemptedLessonIds.has(lesson.id);
    group.lessons.push({
      slug: lesson.slug,
      minutes: lesson.minutes,
      title: text.title,
      summary: text.summary,
      questionCount: lesson._count.quizzes,
      completed,
    });
    if (completed) group.completedCount += 1;
  }

  return [...groups.values()];
}

export interface LessonQuestion {
  id: string;
  question: string;
  options: string[];
  explanation: string;
}

export interface LessonDetail {
  categoryLabel: string;
  minutes: number;
  title: string;
  summary: string;
  body: string[];
  /** The quiz anchor recorded against each attempt: the lesson's first row. */
  quizId: string | null;
  questions: LessonQuestion[];
  nextSlug: string | null;
  completed: boolean;
}

export async function getLessonDetail(
  slug: string,
  userId: string,
  locale: Locale,
): Promise<LessonDetail | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    include: { quizzes: { orderBy: { order: "asc" } } },
  });

  if (!lesson || !lesson.active) return null;

  const text = localized(lesson.translations, locale, readLessonText);
  if (!text) return null;

  const [attemptCount, siblings] = await Promise.all([
    prisma.quizAttempt.count({ where: { userId, lessonId: lesson.id } }),
    prisma.lesson.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { slug: true },
    }),
  ]);

  const position = siblings.findIndex((sibling) => sibling.slug === slug);

  const questions: LessonQuestion[] = lesson.quizzes.flatMap((quiz) => {
    const quizText = localized(quiz.translations, locale, readQuizText);
    if (!quizText) return [];
    // `answerIndex` is deliberately dropped here: the browser must not be able
    // to read the answer before the attempt has been graded.
    return [
      {
        id: quiz.id,
        question: quizText.question,
        options: quizText.options,
        explanation: quizText.explanation,
      },
    ];
  });

  return {
    categoryLabel: categoryLabel(lesson.category, locale),
    minutes: lesson.minutes,
    title: text.title,
    summary: text.summary,
    body: text.body,
    quizId: lesson.quizzes[0]?.id ?? null,
    questions,
    nextSlug: position >= 0 ? (siblings[position + 1]?.slug ?? null) : null,
    completed: attemptCount > 0,
  };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** The exact shape the rules engine in lib/badges expects. */
export type BadgeStats = BadgeProgressInput["stats"];

/**
 * Everything the badge rules read, derived from the user's own rows.
 *
 * Read from the database rather than taken from `currentUser()`: that call is
 * memoised per request, so it would still carry the point total from before the
 * attempt this action is recording.
 */
export async function badgeStats(userId: string): Promise<BadgeStats> {
  const [lessons, attempts, goals, transactionCount, offsets, user] =
    await Promise.all([
      prisma.lesson.findMany({
        where: { active: true },
        select: { id: true, slug: true, category: true },
      }),
      prisma.quizAttempt.findMany({
        where: { userId },
        select: { lessonId: true, score: true, total: true },
      }),
      prisma.savingsGoal.findMany({
        where: { userId, archivedAt: null },
        select: { saved: true, target: true },
      }),
      // Only completed outbound transactions count: a pending or declined
      // transaction is not something the user has actually done.
      prisma.transaction.count({ where: { fromUserId: userId, status: "COMPLETED" } }),
      prisma.offsetContribution.count({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { greenPoints: true, trustScore: true, accountAgeDays: true },
      }),
    ]);

  const completedLessonSlugs: string[] = [];
  const completedLessonsByCategory: Record<string, string[]> = {};
  const lessonCountByCategory: Record<string, number> = {};

  for (const lesson of lessons) {
    lessonCountByCategory[lesson.category] =
      (lessonCountByCategory[lesson.category] ?? 0) + 1;
  }

  for (const attempt of attempts) {
    const lesson = lessons.find((candidate) => candidate.id === attempt.lessonId);
    // An attempt against a lesson that is no longer published still happened,
    // but there is no lesson to count it towards.
    if (!lesson || completedLessonSlugs.includes(lesson.slug)) continue;
    completedLessonSlugs.push(lesson.slug);
    completedLessonsByCategory[lesson.category] = [
      ...(completedLessonsByCategory[lesson.category] ?? []),
      lesson.slug,
    ];
  }

  const bestQuizPct = attempts.reduce(
    (best, attempt) =>
      Math.max(best, attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0),
    0,
  );

  return {
    completedLessonSlugs,
    completedLessonsByCategory,
    lessonCountByCategory,
    bestQuizPct,
    goalCount: goals.length,
    completedGoalCount: goals.filter((goal) => goal.saved.gte(goal.target)).length,
    transactionCount,
    offsetContributionCount: offsets,
    greenPoints: user?.greenPoints ?? 0,
    trustScore: user?.trustScore ?? 0,
    accountAgeDays: user?.accountAgeDays ?? 0,
  };
}

export interface BadgeProgressView {
  slug: string;
  name: string;
  description: string;
  earned: boolean;
  /** 0-1, for the progress bar on a badge still in progress. */
  fraction: number;
  /** Short progress sentence from the rules engine, e.g. "2 of 3 lessons". */
  detail: string;
}

export interface BadgeBoard {
  badges: BadgeProgressView[];
  bestQuizPct: number;
}

/** Earned badges first, then the closest to being earned. */
function byDisplayOrder(a: BadgeProgressView, b: BadgeProgressView): number {
  if (a.earned !== b.earned) return a.earned ? -1 : 1;
  if (a.fraction !== b.fraction) return b.fraction - a.fraction;
  return a.slug.localeCompare(b.slug);
}

async function loadBadgeRows(userId: string) {
  const [badges, held, stats] = await Promise.all([
    prisma.badge.findMany({ orderBy: { slug: "asc" } }),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    badgeStats(userId),
  ]);

  return { badges, held: new Set(held.map((row) => row.badgeId)), stats };
}

function badgeView(
  badge: { slug: string; criteria: Prisma.JsonValue; translations: Prisma.JsonValue },
  stats: BadgeStats,
  locale: Locale,
): BadgeProgressView {
  const criteria = parseCriteria(badge.criteria);
  const text = localized(badge.translations, locale, readBadgeText);
  const progress = criteria ? evaluateBadge({ criteria, stats }) : null;

  return {
    slug: badge.slug,
    name: text?.name ?? badge.slug,
    description: text?.description ?? "",
    earned: progress?.earned ?? false,
    fraction: progress?.fraction ?? 0,
    detail: progress?.detail ?? "",
  };
}

/** Earned and in-progress badges for the badge shelf. */
export async function badgeBoard(userId: string, locale: Locale): Promise<BadgeBoard> {
  const { badges, stats } = await loadBadgeRows(userId);

  return {
    badges: badges.map((badge) => badgeView(badge, stats, locale)).sort(byDisplayOrder),
    bestQuizPct: stats.bestQuizPct,
  };
}

export interface AwardedBadge {
  slug: string;
  name: string;
}

/**
 * Awards every badge the user now qualifies for and does not already hold.
 *
 * Returns the newly awarded ones so the page can say what was won rather than
 * re-reading the whole badge shelf.
 */
export async function awardEarnedBadges(
  userId: string,
  locale: Locale,
): Promise<AwardedBadge[]> {
  const { badges, held, stats } = await loadBadgeRows(userId);

  const fresh = badges.filter((badge) => {
    if (held.has(badge.id)) return false;
    const criteria = parseCriteria(badge.criteria);
    return criteria ? evaluateBadge({ criteria, stats }).earned : false;
  });

  if (fresh.length === 0) return [];

  // `skipDuplicates` rather than a plain create: two submissions racing each
  // other would otherwise hit the (userId, badgeId) unique index and fail.
  await prisma.userBadge.createMany({
    data: fresh.map((badge) => ({ userId, badgeId: badge.id })),
    skipDuplicates: true,
  });

  return fresh.map((badge) => {
    const text = localized(badge.translations, locale, readBadgeText);
    return { slug: badge.slug, name: text?.name ?? badge.slug };
  });
}
