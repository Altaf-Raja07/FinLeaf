import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { loanEligibility } from "@/lib/trust";
import { listLoans } from "@/lib/banking/loans";
import { formatDate, formatMoney } from "@/lib/i18n";
import { PageHeader, Card, CardHeader, EmptyState, Pill, Alert } from "@/components/ui";
import { LoanForm } from "./LoanForm";

/**
 * Micro-loans.
 *
 * Shows the trust score, the amount it unlocks, the factor breakdown that
 * explains the score, and every active loan with its instalment schedule.
 *
 * The explanation is not decorative: under the RBI's Digital Lending
 * Directions 2025, disclosing the basis of an automated credit decision is an
 * expectation, and it is also simply fair. A user who is told "your score is
 * 52" with no way to find out why has no way to improve it.
 */

export default async function LoansPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  const [loans, snapshot] = await Promise.all([
    listLoans(user.id),
    prisma.trustScoreSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { contributions: true, score: true, model: true, createdAt: true },
    }),
  ]);

  const eligibility = loanEligibility(user.trustScore);
  const contributions = Array.isArray(snapshot?.contributions)
    ? (snapshot?.contributions as Array<{
        factor: string;
        label: string;
        points: number;
        detail: string;
      }>)
    : [];

  const activeLoans = loans.filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("loans.title")}
        subtitle={t("loans.subtitle")}
      />

      {/* The score and what it unlocks. */}
      <Card className="flex flex-col gap-4">
        <CardHeader
          title={t("loans.trustScore")}
          subtitle={t("loans.howItWorksBody")}
          action={
            <span className="text-4xl font-bold tnum leading-none">{user.trustScore}</span>
          }
        />

        {eligibility.eligible ? (
          <Alert tone="success" title={t("loans.eligibleFor", { amount: formatMoney(eligibility.maxAmount.toString()) })}>
            {t("loans.howItWorks")}
          </Alert>
        ) : (
          <Alert tone="info" title={t("loans.eligibilityBelow")}>
            {eligibility.reason}
          </Alert>
        )}
      </Card>

      {/* Explainability: what the score is actually made of. */}
      {contributions.length > 0 ? (
        <Card>
          <CardHeader
            title={t("loans.explanation")}
            subtitle={t("dashboard.scoreExplain")}
          />
          <ul className="flex flex-col gap-3">
            {contributions.slice(0, 8).map((factor) => (
              <li key={factor.factor} className="flex items-baseline gap-3">
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{factor.label}</span>
                  <span className="field-help">{factor.detail}</span>
                </span>
                <span
                  className={`shrink-0 text-sm font-bold tnum ${
                    factor.points > 0 ? "text-leaf-700" : "text-risk-high"
                  }`}
                >
                  {factor.points > 0 ? "+" : ""}
                  {factor.points}
                </span>
              </li>
            ))}
          </ul>
          <p className="field-help mt-4">
            {snapshot?.model === "fallback-rules"
              ? "These factors come from the rule-based fallback, because the scoring service was unavailable when this score was computed."
              : "These contributions come from the scoring service and are stored with your score."}
          </p>
        </Card>
      ) : null}

      {/* Apply. */}
      {eligibility.eligible && activeLoans.length === 0 ? (
        <Card>
          <CardHeader title={t("loans.apply", { amount: formatMoney(eligibility.maxAmount.toString()) })} />
          <LoanForm
            maxAmount={eligibility.maxAmount}
            interestRate={eligibility.interestRate}
            maxTermMonths={eligibility.maxTermMonths}
          />
        </Card>
      ) : null}

      {/* Active loans and schedule. */}
      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight">{t("loans.active")}</h2>

        {activeLoans.length === 0 ? (
          <EmptyState title={t("loans.noActive")} body={t("loans.howItWorksBody")} />
        ) : (
          <ul className="flex flex-col gap-4">
            {activeLoans.map((loan) => (
              <Card as="li" key={loan.id} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold tnum">
                        {formatMoney(loan.outstanding.toString())}
                      </p>
                      <Pill status={loan.status === "OVERDUE" ? "bad" : "neutral"}>
                        {loan.status === "OVERDUE" ? t("loans.overdue") : t("loans.title")}
                      </Pill>
                    </div>
                    <p className="field-help">
                      {t("loans.principal")} {formatMoney(loan.principal.toString())} ·{" "}
                      {t("loans.dueDate", { date: formatDate(loan.dueDate, locale) })}
                    </p>
                    <p className="field-help">
                      {t("loans.trustAtOrigin", { score: loan.trustAtOrigin })}
                    </p>
                  </div>

                  {loan.nextInstalment ? (
                    <RepayButton
                      loanId={loan.id}
                      amount={loan.nextInstalment.amount.toString()}
                      dueDate={formatDate(loan.nextInstalment.dueDate, locale)}
                    />
                  ) : null}
                </div>

                {/* Instalment schedule — the whole point of a repayable loan. */}
                <details className="group">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {t("loans.instalments")}
                  </summary>
                  <table className="table mt-2">
                    <thead>
                      <tr>
                        <th scope="col">{t("loans.dueDate")}</th>
                        <th scope="col">{t("loans.amount")}</th>
                        <th scope="col">{t("loans.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loan.instalments.map((instalment) => (
                        <tr key={instalment.id}>
                          <td>{formatDate(instalment.dueDate, locale)}</td>
                          <td className="tnum">{formatMoney(instalment.amount.toString())}</td>
                          <td>
                            <Pill
                              status={
                                instalment.status === "COMPLETED"
                                  ? "good"
                                  : new Date(instalment.dueDate) < new Date()
                                    ? "bad"
                                    : "neutral"
                              }
                            >
                              {instalment.status === "COMPLETED"
                                ? t("loans.repaid")
                                : new Date(instalment.dueDate) < new Date()
                                  ? t("loans.overdue")
                                  : t("loans.pending")}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Small server-action form for paying the next instalment.
 *
 * Lives in its own file because it is a Client Component and this page is a
 * Server Component; a form that posts a Server Action must be the former.
 */
import { RepayButton } from "./RepayButton";
