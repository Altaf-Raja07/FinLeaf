import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getGoals } from "@/lib/screens";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState } from "@/components/ui";
import { ContributeButton, CreateGoalForm } from "@/components/goal-controls";
import { EmptyStateArt } from "@/components/illustration";

export const dynamic = "force-dynamic";

/**
 * Savings goals with progress.
 *
 * Progress is target-relative and recomputed from the stored amounts, so it can
 * never drift from the numbers shown beside it.
 */

export default async function GoalsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const goals = await getGoals(user.id);

  // Consecutive weeks with at least one contribution, for the habit strip.
  const weeksActive = goals.filter((g) => g.weekly > 0).length;

  return (
    <AppShell pathname="/goals" userName={user.fullName}>
      <PageHeader title="Savings goals" subtitle="Small steps, clearly tracked" />

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            title="No goals yet"
            body="A goal turns an amount into a weekly habit. Start with something small."
            art={<EmptyStateArt name="empty-goals" />}
            action={<CreateGoalForm />}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {goals.map((goal) => (
              <Card key={goal.id} className="p-5">
                <h2 className="text-[17px] font-semibold">{goal.title}</h2>
                <p className="text-[13px] text-muted">
                  Target {formatMoney(goal.target, { sign: "never" })}
                </p>

                <div className="mt-4">
                  <div
                    role="progressbar"
                    aria-valuenow={goal.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${goal.title} progress`}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-sunken"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${goal.percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="fl-num text-[20px] font-semibold">{goal.percent}%</span>
                  <span className="text-[14px] text-muted">
                    <span className="fl-num font-medium text-foreground">
                      {formatMoney(goal.saved, { sign: "never" })}
                    </span>{" "}
                    of {formatMoney(goal.target, { sign: "never" })}
                  </span>
                </div>

                <p className="mt-2 text-[13px] text-muted">
                  {goal.weekly > 0
                    ? `${formatMoney(goal.weekly, { sign: "never" })} each week`
                    : "No automatic weekly amount set"}
                </p>

                <div className="mt-4 flex gap-2">
                  {goal.weekly > 0 && <ContributeButton goalId={goal.id} amountPaise={goal.weekly} />}
                  <Link
                    href={`/goals/${goal.id}`}
                    className="inline-flex h-11 items-center rounded-md border border-border-strong px-4 font-semibold hover:bg-sunken"
                  >
                    History
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-4">
            <CreateGoalForm />
          </div>

          {weeksActive > 0 && (
            <Card className="mt-4 p-5">
              <h2 className="text-[17px] font-semibold">Weekly habit</h2>
              <p className="mt-1 text-[14px] text-muted">
                You have saved every week across {weeksActive}{" "}
                {weeksActive === 1 ? "goal" : "goals"} this month.
              </p>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}