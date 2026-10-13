"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { requestLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { quizAttemptSchema } from "@/lib/validation";
import { createNotification } from "@/lib/notify";
import { log } from "@/lib/env";
import {
  awardEarnedBadges,
  quizAnswerIndex,
  POINTS_PER_LESSON,
  type AwardedBadge,
} from "./curriculum";

/**
 * Grade a lesson quiz and record the attempt.
 *
 * Three rules this file exists to hold:
 *
 *   - Answers are graded against the database, never against anything the
 *     browser claims. The client is told which questions it got right; it is
 *     never sent the answer key.
 *   - Green points are awarded on the first attempt for a lesson only, so a
 *     quiz cannot be replayed for points.
 *   - Identity is re-read from the session, not trusted from the form: a server
 *     action is a POST endpoint that can be called without the UI.
 */

export interface QuizAnswerResult {
  quizId: string;
  correct: boolean;
}

export interface QuizActionState {
  error?: string;
  score?: number;
  total?: number;
  /** Per-question outcome, keyed to the question ids the client already has. */
  results?: QuizAnswerResult[];
  points?: number;
  badges?: Array<{ slug: string; name: string }>;
}

/** Answers arrive as `answer-<questionId>` fields; the schema coerces the rest. */
function readAnswers(formData: FormData): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer-")) continue;
    answers[key.slice("answer-".length)] = String(value);
  }
  return answers;
}

export async function submitQuizAction(
  _prev: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = quizAttemptSchema.safeParse({
    quizId: String(formData.get("quizId") ?? ""),
    answers: readAnswers(formData),
  });

  if (!parsed.success) {
    return { error: "Answer every question, then check your answers." };
  }

  // The options are translated in a fixed order across every locale, so a stored
  // answer index denotes the same choice whichever language was read.
  const locale = await requestLocale();

  const anchor = await prisma.quiz.findUnique({
    where: { id: parsed.data.quizId },
    select: {
      id: true,
      lessonId: true,
      lesson: { select: { slug: true, active: true } },
    },
  });

  if (!anchor || !anchor.lesson.active) {
    return { error: "We could not find that lesson." };
  }

  const quizzes = await prisma.quiz.findMany({
    where: { lessonId: anchor.lessonId },
    orderBy: { order: "asc" },
    select: { id: true, translations: true },
  });

  const results: QuizAnswerResult[] = [];
  let score = 0;

  for (const quiz of quizzes) {
    const answerIndex = quizAnswerIndex(quiz.translations, locale);
    if (answerIndex === null) continue;
    const chosen = parsed.data.answers[quiz.id];
    const correct = chosen === answerIndex;
    if (correct) score += 1;
    results.push({ quizId: quiz.id, correct });
  }

  // A lesson whose questions cannot be read has nothing to grade, and recording
  // a zero would misreport the attempt.
  if (results.length === 0) {
    return { error: "That lesson has no questions yet." };
  }

  let firstAttempt: boolean;

  try {
    firstAttempt = await prisma.$transaction(async (tx) => {
      const priorAttempts = await tx.quizAttempt.count({
        where: { userId: user.id, lessonId: anchor.lessonId },
      });

      await tx.quizAttempt.create({
        data: {
          userId: user.id,
          quizId: anchor.id,
          lessonId: anchor.lessonId,
          score,
          total: results.length,
        },
      });

      if (priorAttempts > 0) return false;

      await tx.user.update({
        where: { id: user.id },
        data: { greenPoints: { increment: POINTS_PER_LESSON } },
      });

      return true;
    });
  } catch (error) {
    log("error", "quiz attempt failed", {
      userId: user.id,
      lessonId: anchor.lessonId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { error: "We could not record that attempt." };
  }

  let badges: AwardedBadge[] = [];

  try {
    badges = await awardEarnedBadges(user.id, locale);
  } catch (error) {
    // A badge failure must not cost the user their score: the attempt is already
    // recorded, and the same rules are re-evaluated on the next submission.
    log("error", "badge evaluation failed", {
      userId: user.id,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (firstAttempt) {
    await createNotification({
      userId: user.id,
      type: "LESSON",
      title: translate(locale, "learn.lessonComplete"),
      body: translate(locale, "learn.pointsEarned", { points: POINTS_PER_LESSON }),
      href: `/dashboard/learn/${anchor.lesson.slug}`,
    });
  }

  for (const badge of badges) {
    await createNotification({
      userId: user.id,
      type: "REWARD",
      title: translate(locale, "learn.badgeEarned"),
      body: badge.name,
      href: "/dashboard/learn",
    });
  }

  revalidatePath("/dashboard/learn", "page");
  revalidatePath("/dashboard/learn/[slug]", "page");
  revalidatePath("/dashboard/rewards", "page");
  revalidatePath("/dashboard", "page");

  return {
    score,
    total: results.length,
    results,
    points: firstAttempt ? POINTS_PER_LESSON : 0,
    badges,
  };
}
