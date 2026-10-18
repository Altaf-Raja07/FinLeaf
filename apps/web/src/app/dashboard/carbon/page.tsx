import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, Trees } from "lucide-react";
import { PageHeader, Card, CardHeader, Stat, Pill, EmptyState, Alert, ProgressBar } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import {
  monthlyCarbon,
  carbonByCategory,
  paperlessImpact,
  sustainabilityScore,
  villageLeaderboard,
} from "@/lib/sustainability";
import { factorTable } from "@/lib/carbon";
import { formatCo2e, formatMoney, formatNumber } from "@/lib/i18n";
import { CategoryChart } from "./CategoryChart";
import { CarbonTrendChart } from "./CarbonTrendChart";
import { OffsetForm } from "./OffsetForm";

/**
 * Carbon footprint.
 *
 * Everything on this page is labelled as an estimate, in the subtitle, in the
 * axis titles and next to each figure. The alternative — a bare number — would
 * present a category-based inference as a measurement, which is the exact
 * overstatement the project proposal says to avoid.
 */

const YEAR_AGO = new Date(Date.UTC(new Date().getUTCFullYear() - 1, new Date().getUTCMonth(), 1));

export default async function CarbonPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  const [
    yearly,
    categories,
    paperless,
    sustainability,
    leaderboard,
    factors,
    projects,
    offsets,
  ] = await Promise.all([
    monthlyCarbon(user.id, 12),
    carbonByCategory(user.id, YEAR_AGO),
    paperlessImpact(user.id),
    sustainabilityScore(user.id),
    villageLeaderboard(user.id, 10),
    factorTable(),
    (await import("@/lib/offset")).listOffsetProjects(locale),
    (await import("@/lib/offset")).listContributions(user.id),
  ]);

  const totalYearCo2e = yearly.reduce((sum, month) => sum + month.co2eKg, 0);
  const thisMonth = yearly[yearly.length - 1];
  const hasData = yearly.some((m) => m.transactionCount > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("carbon.title")}
        subtitle={t("carbon.subtitle")}
        action={<Pill status="neutral">{t("carbon.estimate")}</Pill>}
      />

      {/* Headline figures. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("carbon.thisMonth")}
          value={formatCo2e(thisMonth?.co2eKg ?? 0, locale)}
          hint={t("carbon.estimate")}
          icon={<Leaf className="h-4 w-4" />}
        />
        <Stat
          label={t("carbon.sustainabilityScore")}
          value={sustainability}
          hint={t("carbon.scoreHelp")}
          icon={<Leaf className="h-4 w-4" />}
        />
        <Stat
          label={t("carbon.paperless")}
          value={formatNumber(paperless.sheets, locale)}
          hint={t("carbon.paperlessHelp")}
          icon={<Trees className="h-4 w-4" />}
        />
        <Stat
          label={t("dashboard.greenPoints")}
          value={user.greenPoints}
          hint={t("carbon.pointsAvailable", { points: user.greenPoints })}
        />
      </section>

      {!hasData ? (
        <EmptyState
          title={t("carbon.emptyTrend")}
          body="Your monthly estimate appears here once you make a payment or a transfer."
        />
      ) : (
        <>
          {/* Monthly trend. */}
          <Card>
            <CardHeader
              title={t("carbon.trend")}
              subtitle={t("carbon.trendHelp")}
              action={<Pill status="neutral">{t("carbon.estimate")}</Pill>}
            />
            <CarbonTrendChart data={yearly} locale={locale} />
            <p className="field-help mt-3">
              {t("carbon.estimate")} · {formatCo2e(totalYearCo2e, locale)} ({t("history.filterYear")})
            </p>
          </Card>

          {/* Breakdown by category. */}
          {categories.length > 0 ? (
            <Card>
              <CardHeader title={t("carbon.byCategory")} subtitle={t("carbon.byCategoryHelp")} />
              <CategoryChart data={categories} locale={locale} />
              <table className="table mt-4">
                <thead>
                  <tr>
                    <th scope="col">{t("history.category")}</th>
                    <th scope="col">{t("history.amount")}</th>
                    <th scope="col">{t("carbon.estimate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.category}>
                      <th scope="row" className="font-semibold">
                        {category.category.replace(/_/g, " ").toLowerCase()}
                      </th>
                      <td className="tnum">{formatMoney(category.spend.toString())}</td>
                      <td className="tnum">{formatCo2e(category.co2eKg, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
        </>
      )}

      {/* Offset marketplace. */}
      <section className="flex flex-col gap-4">
        <CardHeader
          title={t("carbon.offsetTitle")}
          subtitle={t("carbon.offsetHelp")}
        />

        <Alert tone="info">
          Every project lists its estimated carbon benefit <em>and the source it
          comes from</em>. FinLeaf has not audited any of them.
        </Alert>

        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Card as="li" key={project.id} className="flex flex-col gap-3">
              <div>
                <h3 className="font-bold">{project.name}</h3>
                <p className="field-help text-pretty">{project.description}</p>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="field-help">{t("carbon.cost")}</dt>
                  <dd className="font-bold tnum">
                    {project.costPoints} {t("dashboard.greenPoints").toLowerCase()}
                  </dd>
                </div>
                <div>
                  <dt className="field-help">{t("carbon.methodology")}</dt>
                  <dd className="font-bold tnum">
                    {formatCo2e(project.co2ePerUnitKg, locale)} {project.unit}
                  </dd>
                </div>
              </dl>

              <p className="field-help">{project.methodologySource}</p>

              <OffsetForm
                projectId={project.id}
                projectName={project.name}
                unit={project.unit}
                costPoints={project.costPoints}
                availablePoints={user.greenPoints}
                alreadyFunded={offsets[project.id] ?? 0}
              />
            </Card>
          ))}
        </ul>

        <Card>
          <CardHeader title={t("carbon.totalOffset")} />
          <p className="text-2xl font-bold tnum">
            {formatCo2e(
              Object.values(offsets).reduce((sum, kg) => sum + kg, 0),
              locale,
            )}
          </p>
        </Card>
      </section>

      {/* Leaderboard: same village, so the comparison means something. */}
      <Card>
        <CardHeader title={t("carbon.leaderboard")} subtitle={t("carbon.leaderboardHelp")} />
        {leaderboard.entries.length === 0 ? (
          <EmptyState title={t("state.empty")} body={t("carbon.leaderboardHelp")} />
        ) : (
          <>
            {leaderboard.me ? (
              <p className="mb-3 field-help">
                {t("carbon.rank", {
                  rank: leaderboard.me.rank,
                  total: leaderboard.total,
                  village: user.village,
                })}
              </p>
            ) : null}
            <ol className="flex flex-col divide-y divide-rule">
              {leaderboard.entries.map((entry) => (
                <li key={entry.rank} className="flex items-center gap-3 py-2">
                  <span className="w-8 shrink-0 text-sm font-bold tnum text-ink-faint">
                    {entry.rank}
                  </span>
                  <span className="flex-1 truncate font-semibold">
                    {entry.isMe ? t("misc.you") : entry.name ?? t("misc.you")}
                  </span>
                  <span className="font-bold tnum text-leaf-700">{entry.sustainability}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <ProgressBar
                value={user.greenPoints}
                max={400}
                label={t("rewards.pointsEarned")}
              />
            </div>
          </>
        )}
      </Card>

      {/* Methodology: the numbers and where they come from. */}
      <Card>
        <CardHeader title={t("carbon.methodology")} />
        <p className="field-help text-pretty">{t("carbon.methodologyBody")}</p>
        <table className="table mt-4">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">kg CO₂e per ₹100</th>
              <th scope="col">Green points</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((factor) => (
              <tr key={factor.category}>
                <th scope="row" className="font-semibold">
                  {factor.label}
                </th>
                <td className="tnum">{factor.factorPer100Inr}</td>
                <td className="tnum">{factor.greenPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field-help mt-4">
          <Link href="/methodology" className="font-semibold underline">
            {t("carbon.methodology")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
