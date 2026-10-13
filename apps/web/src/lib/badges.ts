/**
 * Badge rules.
 *
 * Pure logic, nothing environment-dependent and nothing secret. It is intentionally
 * not marked `server-only` because the same evaluation runs in the seed script,
 * in the badge-awarding service and, through the API, when a user looks up
 * their badge progress.
 */

export type BadgeCriteria =
  | { type: "lesson_completed"; lesson: string }
  | { type: "category_complete"; category: string }
  | { type: "total_lessons"; count: number }
  | { type: "quiz_score"; minPct: number }
  | { type: "goal_created"; count: number }
  | { type: "goal_completed"; count: number }
  | { type: "transaction_count"; count: number }
  | { type: "offset_contributions"; count: number }
  | { type: "green_points"; threshold: number }
  | { type: "trust_score"; threshold: number }
  | { type: "voucher_redeemed"; count: number }
  | { type: "days_active"; count: number };

export interface BadgeProgress {
  /** 0-1 progress toward the badge. */
  fraction: number;
  /** 0-1, since criteria are all "met or not" thresholds. */
  earned: boolean;
  /** Short human-readable progress, e.g. "2 of 3 lessons". */
  detail: string;
}

export interface BadgeProgressInput {
  criteria: BadgeCriteria;
  stats: {
    completedLessonSlugs: string[];
    completedLessonsByCategory: Record<string, string[]>;
    lessonCountByCategory: Record<string, number>;
    bestQuizPct: number;
    goalCount: number;
    completedGoalCount: number;
    transactionCount: number;
    offsetContributionCount: number;
    voucherRedeemedCount: number;
    greenPoints: number;
    trustScore: number;
    accountAgeDays: number;
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function ratio(current: number, target: number): BadgeProgress {
  return {
    fraction: clamp01(target <= 0 ? 1 : current / target),
    earned: current >= target,
    detail: `${Math.min(current, target)} of ${target}`,
  };
}

/**
 * Evaluates one badge's criteria against the user's stats.
 *
 * The comparison is deliberately made in this one function so adding a badge
 * type requires editing exactly one switch.
 */
export function evaluateBadge({
  criteria,
  stats,
}: BadgeProgressInput): BadgeProgress {
  switch (criteria.type) {
    case "lesson_completed": {
      const done = stats.completedLessonSlugs.includes(criteria.lesson);
      return {
        fraction: done ? 1 : 0,
        earned: done,
        detail: done ? "Completed" : "Not completed",
      };
    }

    case "category_complete": {
      const total = stats.lessonCountByCategory[criteria.category] ?? 0;
      const done = (stats.completedLessonsByCategory[criteria.category] ?? []).length;
      const result = ratio(done, total);
      return { ...result, detail: total === 0 ? "No lessons" : `${result.detail} lessons` };
    }

    case "total_lessons":
      return {
        ...ratio(stats.completedLessonSlugs.length, criteria.count),
        detail: `${ratio(stats.completedLessonSlugs.length, criteria.count).detail} lessons`,
      };

    case "quiz_score": {
      const earned = stats.bestQuizPct >= criteria.minPct;
      return {
        fraction: earned ? 1 : clamp01(stats.bestQuizPct / criteria.minPct || 0),
        earned,
        detail: earned
          ? `Scored ${criteria.minPct}% on a quiz`
          : `Best quiz score ${stats.bestQuizPct}%`,
      };
    }

    case "goal_created":
      return { ...ratio(stats.goalCount, criteria.count), detail: `${ratio(stats.goalCount, criteria.count).detail} goals` };

    case "goal_completed":
      return { ...ratio(stats.completedGoalCount, criteria.count), detail: `${ratio(stats.completedGoalCount, criteria.count).detail} goals` };

    case "transaction_count":
      return { ...ratio(stats.transactionCount, criteria.count), detail: `${ratio(stats.transactionCount, criteria.count).detail} transactions` };

    case "offset_contributions":
      return { ...ratio(stats.offsetContributionCount, criteria.count), detail: `${ratio(stats.offsetContributionCount, criteria.count).detail} contributions` };

    case "voucher_redeemed":
      return { ...ratio(stats.voucherRedeemedCount, criteria.count), detail: `${ratio(stats.voucherRedeemedCount, criteria.count).detail} vouchers` };

    case "green_points": {
      const result = ratio(stats.greenPoints, criteria.threshold);
      return { ...result, detail: `${Math.min(stats.greenPoints, criteria.threshold)} of ${criteria.threshold} points` };
    }

    case "trust_score": {
      const result = ratio(stats.trustScore, criteria.threshold);
      return { ...result, detail: `${Math.min(stats.trustScore, criteria.threshold)} of ${criteria.threshold}` };
    }

    case "days_active": {
      const result = ratio(stats.accountAgeDays, criteria.count);
      return { ...result, detail: `${Math.min(stats.accountAgeDays, criteria.count)} of ${criteria.count} days` };
    }
  }
}

/** Parses loose JSON into criteria, returning null when it is not a known rule. */
export function parseCriteria(value: unknown): BadgeCriteria | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const type = candidate.type;

  if (typeof type !== "string") return null;

  switch (type) {
    case "lesson_completed":
      return typeof candidate.lesson === "string"
        ? { type, lesson: candidate.lesson }
        : null;
    case "category_complete":
      return typeof candidate.category === "string"
        ? { type, category: candidate.category }
        : null;
    case "total_lessons":
    case "goal_created":
    case "goal_completed":
    case "transaction_count":
    case "offset_contributions":
    case "voucher_redeemed":
    case "days_active":
      return typeof candidate.count === "number"
        ? { type, count: candidate.count }
        : null;
    case "quiz_score":
      return typeof candidate.minPct === "number"
        ? { type, minPct: candidate.minPct }
        : null;
    case "green_points":
    case "trust_score":
      return typeof candidate.threshold === "number"
        ? { type, threshold: candidate.threshold }
        : null;
    default:
      return null;
  }
}
