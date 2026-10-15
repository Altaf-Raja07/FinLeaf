import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Leaf } from "lucide-react";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pill,
  Stat,
} from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/i18n";
import { rewardsOverview } from "./rewards-data";

/**
 * Green rewards.
 *
 * The honest framing runs through the whole page. Green points are not cash,
 * they are not redeemable for discount codes, and FinLeaf has no partner
 * network — so the page says what points are actually for (spending them on
 * offset projects) instead of listing a rewards catalogue that does not exist.
 *
 * An earlier version of this screen showed a "voucher" section backed by a
 * `Voucher` table nothing ever wrote to. That was dead UI, removed rather than
 * shelled.
 */

export default async function RewardsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const overview = await rewardsOverview(user.id);
  const { balance } = overview;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("rewards.title")}
        subtitle={t("rewards.subtitle")}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t("rewards.points")}
          value={balance}
          hint={t("carbon.pointsAvailable", { points: balance })}
          icon={<Leaf className="h-4 w-4" />}
        />
        <Stat label={t("rewards.pointsEarned")} value={overview.earnedFromPayments} />
        <Stat
          label={t("rewards.pointsSpent")}
          value={overview.spentOnOffsets}
          hint={t("carbon.offsetTitle")}
        />
      </section>

      {/* What points are for. */}
      <section className="flex flex-col gap-3">
        <CardHeader title={t("rewards.spendOn")} />

        <Alert tone="info">{t("rewards.redemptionNote")}</Alert>

        {balance === 0 ? (
          <EmptyState
            title={t("rewards.noVouchers")}
            body="Points appear here as you make payments in low-carbon categories: public transport, an online bill payment, a mobile recharge."
            icon={<Gift className="h-8 w-8" />}
          />
        ) : balance < Math.min(...overview.spendOptions.map((o) => o.costPoints)) ? (
          <EmptyState
            title={t("rewards.keepGoing")}
            body={`You have ${balance} points. The smallest project costs ${Math.min(...overview.spendOptions.map((o) => o.costPoints))}.`}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {overview.spendOptions
              .filter((option) => option.affordable > 0)
              .map((option) => (
                <Card as="li" key={option.slug} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-bold truncate">{option.name}</h3>
                    <Pill status="good">
                      × {option.affordable} {option.unit}
                    </Pill>
                  </div>
                  <p className="field-help">
                    {option.costPoints} {t("rewards.points").toLowerCase()} per {option.unit}
                  </p>
                  <Link
                    href="/dashboard/carbon"
                    className="btn btn-secondary mt-1 no-underline"
                  >
                    {t("carbon.offsetTitle")}
                  </Link>
                </Card>
              ))}
          </ul>
        )}
      </section>

      {/* Where the points came from. */}
      <Card>
        <CardHeader title={t("rewards.pointsEarned")} />

        {overview.history.length === 0 ? (
          <EmptyState
            title={t("state.empty")}
            body="Points appear here as you make payments in low-carbon categories."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-rule">
            {overview.history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span className="text-ink-soft">
                  {t("rewards.earnedOn", { category: entry.categoryLabel })}
                  {" · "}
                  {formatDateTime(entry.createdAt, locale)}
                </span>
                <span className="font-bold tnum text-leaf-700">+{entry.points}</span>
              </li>
            ))}
          </ul>
        )}

        {/*
          Stated because it is true and would otherwise look like a bug: points
          are also credited for finishing a lesson, and that path writes no
          transaction row.
        */}
        <p className="field-help mt-4">
          {t("rewards.lessonPointsNote")}
        </p>
      </Card>

      {/* Village leaderboard, so the comparison is against peers. */}
      <Card>
        <CardHeader
          title={t("rewards.leaderboard")}
          subtitle={`${t("rewards.leaderboardVillage")}: ${overview.village}`}
        />

        {overview.leaderboard.length === 0 ? (
          <EmptyState title={t("state.empty")} body={t("carbon.leaderboardHelp")} />
        ) : (
          <>
            {overview.rank ? (
              <p className="mb-3 field-help">
                {t("carbon.rank", {
                  rank: overview.rank,
                  total: overview.participants,
                  village: overview.village,
                })}
              </p>
            ) : null}

            <ol className="flex flex-col divide-y divide-rule">
              {overview.leaderboard.map((entry) => (
                <li key={entry.rank} className="flex items-center gap-3 py-2">
                  <span className="w-8 shrink-0 text-sm font-bold tnum text-ink-faint">
                    {entry.rank}
                  </span>
                  <span className="flex-1 truncate font-semibold">
                    {entry.isMe ? t("misc.you") : (entry.name ?? t("misc.you"))}
                  </span>
                  <span className="font-bold tnum text-leaf-700">
                    {entry.sustainability}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </Card>
    </div>
  );
}
