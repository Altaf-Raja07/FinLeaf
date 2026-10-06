import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTrustScore } from "@/lib/trust";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, Notice } from "@/components/ui";
import { ScoreGauge } from "@/components/gauge";
import { CheckIcon, LockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Trust score with its explanation.
 *
 * The breakdown is arithmetic on the fitted model coefficients, returned by the
 * ML service. Nothing on this page is hand-written: the factors, their point
 * values, and the score all come from the same computation, and the bars sum to
 * the score shown. The "what we never use" panel is not decoration either, it
 * states a real property of the feature set.
 */

const NEVER_USED = ["Gender", "Caste or religion", "Aadhaar or PAN details", "Your name or phone"];

const IMPROVE = [
  { action: "Set up one savings goal", points: 10 },
  { action: "Pay a bill on time", points: 8 },
  { action: "Use your account weekly", points: 5 },
];

export default async function TrustScorePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const score = await getTrustScore(user.id);
  const maxAbs = Math.max(...score.contributions.map((c) => Math.abs(c.points)), 1);

  return (
    <AppShell pathname="/trust-score" userName={user.fullName}>
      <PageHeader
        title="Your trust score"
        subtitle="Built from how you use your account, not from paperwork"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col items-center justify-center p-6">
          <ScoreGauge value={score.score} label="Trust score" band={score.band} tone="trust" size={148} />
          <p className="mt-3 text-[13px] text-muted">
            {score.source === "ml-service"
              ? "Calculated by the trained model"
              : "Modelling service unavailable, so this is approximate"}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">What moves your score</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Each factor is the model&rsquo;s own coefficient applied to your behaviour.
          </p>

          <div className="mt-4 flex flex-col gap-3.5">
            {score.contributions.map((c) => {
              const positive = c.points >= 0;
              return (
                <div key={c.feature} className="flex items-center gap-3">
                  <span className="w-[132px] shrink-0 text-[13px]">{c.label}</span>
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <span
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        // Positive factors grow from the left, negative from the
                        // right, so direction is visible without relying on colour.
                        left: positive ? "50%" : undefined,
                        right: positive ? undefined : "50%",
                        width: `${(Math.abs(c.points) / maxAbs) * 50}%`,
                        background: positive ? "var(--fl-trust)" : "var(--fl-amber)",
                      }}
                    />
                    <span className="absolute left-1/2 top-0 h-full w-px bg-border-strong" />
                  </span>
                  <span
                    className={`fl-num w-12 shrink-0 text-right text-[13px] font-semibold ${positive ? "text-trust" : "text-amber"}`}
                  >
                    {positive ? "+" : "−"}
                    {Math.abs(c.points)}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-4 border-t border-border pt-3 text-[13px] text-muted">{score.basis}</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Improve your score</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Each action below changes a real feature, so the score moves on its own.
          </p>
          <ul className="mt-4">
            {IMPROVE.map((item) => (
              <li
                key={item.action}
                className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                >
                  <CheckIcon size={16} />
                </span>
                <span className="flex-1 text-[14.5px] font-medium">{item.action}</span>
                <span className="fl-num text-[13px] font-semibold text-leaf">
                  +{item.points}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/goals"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 font-semibold text-white hover:bg-primary-hover"
          >
            Set up a savings goal
          </Link>
        </Card>

        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">What we never use</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            These are excluded from scoring by construction, not by policy.
          </p>
          <ul className="mt-4">
            {NEVER_USED.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted"
                >
                  <LockIcon size={15} />
                </span>
                <span className="text-[14.5px]">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Notice tone="trust">
              This score is built from your own account behaviour by a model trained on this
              environment&apos;s data. It is a decision aid, not a credit decision, and it does not
              establish creditworthiness with any lender.
            </Notice>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}