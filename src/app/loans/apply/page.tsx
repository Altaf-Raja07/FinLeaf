import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTrustScore } from "@/lib/trust";
import { eligibleLoanAmount } from "@/lib/screens";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, Notice } from "@/components/ui";
import { LoanApplyForm } from "@/components/loan-form";

export const dynamic = "force-dynamic";

/**
 * Loan application.
 *
 * The requested amount is capped at what the trust score allows, and the cap is
 * re-checked on the server rather than trusted from the form. Submitting records
 * the application as "submitted"; nothing is approved automatically, because a
 * prototype cannot approve credit.
 */
export default async function LoanApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const score = await getTrustScore(user.id);
  const eligibility = eligibleLoanAmount(score.score);
  const requested = Number(params.amount ?? eligibility.limitPaise);

  return (
    <AppShell pathname="/loans" userName={user.fullName}>
      <PageHeader title="Apply for a micro-loan" subtitle="Small, manageable credit based on your trust score" />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <LoanApplyForm
            maxAmountPaise={eligibility.limitPaise}
            initialAmountPaise={Number.isFinite(requested) ? requested : eligibility.limitPaise}
            instalments={eligibility.instalmentPaise}
            instalmentPaise={eligibility.instalmentPaise}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Your limit</h2>
          <p className="fl-num mt-2 text-[30px] leading-none font-semibold">
            {formatMoney(eligibility.limitPaise, { sign: "never" })}
          </p>
          <p className="mt-1 text-[13px] text-muted">From trust score {score.score} of 100</p>
          <div className="mt-4">
            <Notice tone="trust">
              This is a simulated application. It is recorded in the database and never approved by a
              real lender.
            </Notice>
          </div>
          <Link href="/loans" className="mt-4 inline-block text-[14px] font-medium text-primary">
            Back to loans
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}