import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTrustScore } from "@/lib/trust";
import { getLoans, eligibleLoanAmount } from "@/lib/screens";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, Notice, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Micro-loan eligibility and application status.
 *
 * The eligible amount is a pure function of the trust score, so it can never
 * disagree with the score shown on the trust page. Nothing here approves credit.
 */

const STATUS_META: Record<string, { label: string; tone: "amber" | "leaf" | "neutral" | "danger" }> = {
  submitted: { label: "Submitted", tone: "neutral" },
  in_review: { label: "In review", tone: "amber" },
  approved: { label: "Approved", tone: "leaf" },
  repaid: { label: "Repaid", tone: "leaf" },
  declined: { label: "Declined", tone: "danger" },
};

export default async function LoansPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [score, loans] = await Promise.all([getTrustScore(user.id), getLoans(user.id)]);
  const eligibility = eligibleLoanAmount(score.score);

  return (
    <AppShell pathname="/loans" userName={user.fullName}>
      <PageHeader title="Micro-loans" subtitle="Small loans decided by your trust score" />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <p className="text-[15px] font-semibold">You&rsquo;re eligible for</p>
          <p className="fl-num mt-2 text-[40px] leading-none font-semibold tracking-tight">
            {formatMoney(eligibility.limitPaise, { sign: "never" })}
          </p>
          <p className="mt-2 text-[14px] text-muted">
            Based on trust score <span className="fl-num font-medium text-foreground">{score.score}</span> of
            100
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/loans/apply?amount=${eligibility.limitPaise}`}
              className="inline-flex h-11 items-center rounded-md bg-primary px-5 font-semibold text-white hover:bg-primary-hover"
            >
              Apply for {formatMoney(eligibility.limitPaise, { sign: "never" })}
            </Link>
            <Link
              href="/trust-score"
              className="inline-flex h-11 items-center rounded-md border border-border-strong px-5 font-semibold hover:bg-sunken"
            >
              How this is worked out
            </Link>
          </div>

          <p className="mt-4 text-[14px] text-muted">
            Repayment over {eligibility.instalmentPaise} monthly instalments of{" "}
            <span className="fl-num font-medium text-foreground">
              {formatMoney(eligibility.instalmentPaise, { sign: "never" })}
            </span>
            .
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">How the amount is worked out</h2>
          <ul className="mt-4">
            {[
              { label: "Trust score", value: `${score.score} of 100` },
              { label: "On-time bill payments", value: onTimeLabel(score) },
              { label: "Savings record", value: savingsLabel(score) },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between border-b border-border py-3 last:border-b-0"
              >
                <span className="text-[14px] text-muted">{row.label}</span>
                <span className="text-[14px] font-semibold">{row.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Notice tone="trust">
              This is a simulation, not a credit approval. No real lender is involved and no loan can
              be borrowed here.
            </Notice>
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="text-[17px] font-semibold">Your applications</h2>
        </div>
        {loans.length === 0 ? (
          <EmptyState
            title="No applications yet"
            body="When you apply for a micro-loan, its status will be tracked here."
          />
        ) : (
          <ul>
            {loans.map((loan) => {
              const meta = STATUS_META[loan.status] ?? STATUS_META.submitted;
              return (
                <li
                  key={loan.id}
                  className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">
                      {formatMoney(loan.principal, { sign: "never" })}
                    </p>
                    <p className="text-[13px] text-muted">
                      Applied {new Date(loan.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {loan.decidedAt &&
                        ` · Settled ${new Date(loan.decidedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}`}
                    </p>
                  </div>
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}

/** Describe the on-time factor from the model's own contribution, not a guess. */
function onTimeLabel(score: Awaited<ReturnType<typeof getTrustScore>>): string {
  const c = score.contributions.find((x) => x.feature === "bill_on_time_ratio");
  if (!c) return "Not enough history";
  if (c.points >= 12) return "Strong";
  if (c.points >= 6) return "Mixed";
  return "Needs attention";
}

function savingsLabel(score: Awaited<ReturnType<typeof getTrustScore>>): string {
  const c = score.contributions.find((x) => x.feature === "savings_regularity");
  if (!c) return "No goals yet";
  if (c.points >= 12) return "Improving";
  if (c.points > 0) return "Started";
  return "No activity";
}