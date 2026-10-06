import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getAccounts, getGreenPoints, getMonthEmissions, getTransactions } from "@/lib/queries";
import { getTrustScore, latestTrustScore } from "@/lib/trust";
import { handler, parseBody, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";

/**
 * Resolve a spoken or typed question against the signed-in user's real data.
 *
 * Rule-based intent matching, deliberately. The proposal asks for "a simple
 * rule-based or LLM-powered chatbot answering basic banking and finance
 * questions"; rules are the right choice here because every answer can be traced
 * to a query, none can be hallucinated, and it works with no external service.
 *
 * The assistant never claims to have done something it did not do: each intent
 * either matches real data or falls through to a clear "I did not catch that".
 */

const schema = z.object({
  spoken: z.string().trim().min(1, "Say or type a question.").max(400),
});

interface Intent {
  test: RegExp;
  reply: (facts: Facts) => string;
}

interface Facts {
  balance: number;
  accountCount: number;
  trustScore: number | null;
  trustBand: string | null;
  emissions: number;
  points: number;
  spentThisMonth: number;
  biggestCategory: string | null;
}

const INTENTS: Intent[] = [
  {
    test: /\b(balance|how much (money|do i have)|kitna|paisa)\b/i,
    reply: (f) =>
      `Your balance is ${formatMoney(f.balance, { sign: "never" })}, across ${f.accountCount} ${
        f.accountCount === 1 ? "account" : "accounts"
      }.`,
  },
  {
    test: /\b(trust score|trust|reliability|score)\b/i,
    reply: (f) =>
      f.trustScore === null
        ? "Your trust score has not been worked out yet. Open the trust score page and it will calculate."
        : `Your trust score is ${f.trustScore} out of 100, which reads as ${f.trustBand?.toLowerCase()}. Regular saving and on-time bill payments move it most.`,
  },
  {
    test: /\b(points?|reward|offset|tree)\b/i,
    reply: (f) =>
      `You have ${f.points.toLocaleString("en-IN")} green points. You spend them on discounts in the rewards page, or on tree planting and clean cookstoves in the offsets marketplace.`,
  },
  {
    // No bare "green": it appears inside "green points", which is a different
    // question. The carbon patterns all name the concept explicitly.
    test: /\b(carbon|co2|emissions?|footprint|pollut|environment)\b/i,
    reply: (f) =>
      `This month your estimated footprint is ${f.emissions} kg CO2e${
        f.biggestCategory ? `, with ${f.biggestCategory} the largest contributor` : ""
      }. That is an estimate from category averages, not a measurement.`,
  },
  {
    test: /\b(spent|spend|spending|expense|spent this)\b/i,
    reply: (f) =>
      `You have spent ${formatMoney(f.spentThisMonth, { sign: "never" })} this month${
        f.biggestCategory ? `, mostly on ${f.biggestCategory}` : ""
      }.`,
  },
  {
    test: /\b(safe|safety|fraud|scam|scammed|stolen|stole|otp|password|pin)\b/i,
    reply: () =>
      "No real bank ever asks for your OTP, PIN or password over a call. If someone does, it is not your bank, so end the call. Nothing in FinLeaf can move real money.",
  },
  {
    test: /\b(loan|loans|borrow|borrowing|credit)\b/i,
    reply: (f) =>
      f.trustScore === null
        ? "Your loan limit depends on your trust score. Open the loans page once your score is calculated."
        : `With a trust score of ${f.trustScore}, the loans page will show you the amount you qualify for. It is an estimate, not an approval.`,
  },
  {
    test: /\b(save|saves|saving|savings|goal|goals)\b/i,
    reply: () =>
      "Savings goals turn an amount into a weekly habit. Open the Save page to add one, then contribute the same amount each week. Regular saving is the biggest thing that raises your trust score.",
  },
  {
    test: /\b(help|what can you do|commands)\b/i,
    reply: () =>
      "Try asking about your balance, your trust score, your carbon footprint, your green points, or how to spot a fraud call.",
  },
];

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to ask about your account.");

    const { spoken } = await parseBody(request, schema);

    const [accounts, emissions, points, storedTrust, recent] = await Promise.all([
      getAccounts(user.id),
      getMonthEmissions(user.id),
      getGreenPoints(user.id),
      latestTrustScore(user.id),
      getTransactions(user.id, { limit: 30 }),
    ]);

    // Only this month's debits count towards "spent this month".
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthRows = recent.rows.filter((r) => new Date(r.createdAt) >= monthStart);
    const spentThisMonth = monthRows
      .filter((r) => r.direction === "debit")
      .reduce((sum, r) => sum + r.amount, 0);

    const byCategory = new Map<string, number>();
    for (const row of monthRows) {
      if (row.direction !== "debit") continue;
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
    }
    const biggestCategory =
      [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Group accounts are a household's shared money, not this person's spendable
    // balance. The dashboard excludes them from its total, so the assistant must
    // too, or the two screens would quote different numbers for "your balance".
    const ownAccounts = accounts.filter((a) => a.kind !== "group");

    // Compute the score if it has never been calculated, so a first-time user is
    // not told their score does not exist when the same figure shows on the
    // dashboard.
    const resolvedTrust = storedTrust ?? (await getTrustScore(user.id));

    const facts: Facts = {
      balance: ownAccounts.reduce((sum, a) => sum + a.balance, 0),
      accountCount: ownAccounts.length,
      trustScore: resolvedTrust?.score ?? null,
      trustBand: resolvedTrust?.band ?? null,
      emissions,
      points: points.balance,
      spentThisMonth,
      biggestCategory,
    };

    const matched = INTENTS.find((intent) => intent.test.test(spoken));

    return NextResponse.json({
      ok: true as const,
      data: {
        spoken,
        // A miss says so plainly. Inventing an answer would be worse than useless
        // for a user deciding whether to trust the figure.
        reply: matched
          ? matched.reply(facts)
          : "I did not catch that. Try asking about your balance, your trust score, your carbon footprint, or your green points.",
        understood: matched !== undefined,
      },
    });
  })();
}