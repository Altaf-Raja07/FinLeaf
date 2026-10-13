import "server-only";
import { prisma } from "@/lib/db";
import { villageLeaderboard } from "@/lib/sustainability";
import { listOffsetProjects } from "@/lib/offset";

/**
 * Green points, rewards and the village leaderboard.
 *
 * The one thing to be precise about: points are credited in two places — on a
 * transaction, from the emission-factor table, and once per lesson completed.
 * Only the first writes a transaction row, so the earned total below can be
 * lower than the balance for anyone who has finished a lesson. The page states
 * that rather than leaving two numbers on the same screen to disagree.
 */

export interface PointsEntry {
  id: string;
  createdAt: Date;
  categoryLabel: string;
  points: number;
}

export interface SpendOption {
  slug: string;
  name: string;
  costPoints: number;
  unit: string;
  /** How many units of this project the balance can fund. */
  affordable: number;
}

export interface RewardsOverview {
  balance: number;
  earnedFromPayments: number;
  spentOnOffsets: number;
  history: PointsEntry[];
  /**
   * What the balance can buy, which is the purpose of it. Points have no cash
   * value and no partner network, so spending them on an offset is the only
   * thing they are for.
   */
  spendOptions: SpendOption[];
  village: string;
  rank: number | null;
  participants: number;
  leaderboard: Array<{
    rank: number;
    isMe: boolean;
    name: string | null;
    sustainability: number;
    greenPoints: number;
  }>;
}

/** `TRAVEL_PUBLIC` -> `travel public`, matching how history shows categories. */
function categoryLabel(category: string): string {
  return category.replace(/_/g, " ").toLowerCase();
}

export async function rewardsOverview(userId: string): Promise<RewardsOverview> {
  const pointsWhere = {
    greenPoints: { gt: 0 },
    // Rewards follow spending the user actually made, which is money out of
    // their account. An incoming credit is not a choice they made.
    fromUserId: userId,
    status: "COMPLETED" as const,
  };

  const [earned, spent, history, user, leaderboard, projects] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { greenPoints: true }, where: pointsWhere }),
    prisma.offsetContribution.aggregate({ _sum: { pointsSpent: true }, where: { userId } }),
    prisma.transaction.findMany({
      where: pointsWhere,
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, createdAt: true, category: true, greenPoints: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { greenPoints: true, village: true },
    }),
    villageLeaderboard(userId, 10),
    listOffsetProjects("en"),
  ]);

  const balance = user?.greenPoints ?? 0;

  return {
    balance,
    earnedFromPayments: earned._sum.greenPoints ?? 0,
    spentOnOffsets: spent._sum.pointsSpent ?? 0,
    history: history.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      categoryLabel: categoryLabel(entry.category),
      points: entry.greenPoints,
    })),
    spendOptions: projects.slice(0, 4).map((project) => ({
      slug: project.slug,
      name: project.name,
      costPoints: project.costPoints,
      unit: project.unit,
      affordable: Math.floor(balance / project.costPoints),
    })),
    village: user?.village ?? "",
    rank: leaderboard.me?.rank ?? null,
    participants: leaderboard.total,
    leaderboard: leaderboard.entries.map((entry) => ({
      rank: entry.rank,
      isMe: entry.isMe,
      name: entry.name,
      sustainability: entry.sustainability,
      greenPoints: entry.greenPoints,
    })),
  };
}
