import { redirect } from "next/navigation";
import { EmptyState, PageHeader, Card, CardHeader, ProgressBar, Alert, Stat, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { listSavingsGoals } from "@/lib/savings";
import { formatDate, formatMoney, formatDateTime } from "@/lib/i18n";
import { GoalForm } from "./GoalForm";
import { ContributeForm } from "./ContributeForm";

/**
 * Savings goals.
 *
 * Progress is a progress bar *plus* a number. A bar alone says nothing to a
 * screen reader, and very little to someone with reduced vision — both are in
 * this product's target audience.
 */

export default async function SavingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const goals = await listSavingsGoals(user.id);

  const totalSaved = goals.reduce((sum, goal) => sum + goal.saved, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);
  const completed = goals.filter((goal) => goal.saved >= goal.target).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("savings.title")}
        subtitle={t("savings.subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("savings.totalSaved")} value={formatMoney(totalSaved.toString())} />
        <Stat
          label={t("savings.target")}
          value={formatMoney(totalTarget.toString())}
          hint={t("savings.progressPercent", { percent: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0 })}
        />
        <Stat
          label={t("savings.goalName")}
          value={`${goals.length}`}
          hint={t("savings.emptyHelp")}
        />
      </div>

      {completed > 0 ? (
        <Alert tone="success" title={t("savings.completed")}>
          {t("savings.goalReached", { count: completed })}
        </Alert>
      ) : null}

      <Card>
        <CardHeader title={t("savings.create")} subtitle={t("savings.emptyHelp")} />
        <GoalForm />
      </Card>

      <section className="flex flex-col gap-4">
        {goals.length === 0 ? (
          <EmptyState
            title={t("savings.empty")}
            body={t("savings.emptyHelp")}
            icon={<span className="text-3xl" aria-hidden="true">🎯</span>}
          />
        ) : (
          goals.map((goal) => (
            <Card as="li" key={goal.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight truncate">{goal.title}</h2>
                    {goal.saved >= goal.target ? (
                      <Pill status="good">{t("savings.completed")}</Pill>
                    ) : null}
                  </div>
                  <p className="field-help">
                    {t("savings.progress", {
                      saved: formatMoney(goal.saved.toString()),
                      target: formatMoney(goal.target.toString()),
                    })}
                    {goal.dueDate
                      ? ` · ${t("savings.dueDate")} ${formatDate(goal.dueDate, locale)}`
                      : ""}
                  </p>
                </div>

                <p className="text-2xl font-bold tnum leading-none">{goal.percent}%</p>
              </div>

              <ProgressBar
                value={goal.saved}
                max={goal.target}
                label={`${goal.saved} of ${goal.target} saved`}
              />

              {goal.saved < goal.target ? (
                <ContributeForm goalId={goal.id} maxAmount={goal.remaining} title={goal.title} />
              ) : null}

              {goal.contributions.length > 0 ? (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {t("savings.contributions")}
                  </summary>
                  <ul className="mt-2 flex flex-col divide-y divide-rule">
                    {goal.contributions.map((contribution) => (
                      <li key={contribution.id} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="text-ink-soft">
                          {formatDateTime(contribution.createdAt, locale)}
                        </span>
                        <span className="font-semibold tnum">
                          +{formatMoney(contribution.amount.toString())}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
