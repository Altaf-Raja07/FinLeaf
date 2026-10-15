import type { Metadata } from "next";
import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";
import { Card, CardHeader, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";

/**
 * About and methodology.
 *
 * A single page that says what this platform is, what it is not, and exactly
 * where its numbers come from. The last part is the point: an emission figure a
 * user cannot trace is not information, and the honesty of the whole product
 * stands or falls on this page being complete.
 */

export const metadata: Metadata = {
  title: "About and methodology",
  description:
    "What FinLeaf is, what it is not, and where its carbon estimates and trust scores come from.",
};

export default async function MethodologyPage() {
  const { t } = await translator();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <LeafMark className="h-9 w-9 text-leaf-700" />
        <span className="text-lg font-bold tracking-tight">FinLeaf</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-balance">
        {t("home.about.title")}
      </h1>

      <p className="leading-relaxed text-ink-soft text-pretty">
        {t("home.about.body")}
      </p>

      {/* What this platform does not do. */}
      <Card>
        <CardHeader title={t("home.demo.title")} />
        <p className="leading-relaxed text-ink-soft text-pretty">{t("home.demo.body")}</p>
      </Card>

      {/* Carbon methodology, in full. */}
      <Card>
        <CardHeader
          title="Carbon estimation"
          action={<Pill status="neutral">Estimate</Pill>}
        />

        <div className="flex flex-col gap-4">
          <p className="leading-relaxed text-ink-soft text-pretty">
            {t("carbon.methodologyBody")}
          </p>

          <div className="card-quiet">
            <p className="mb-2 text-sm font-bold">The method, in full</p>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-soft">
              <li>Every transaction is tagged with a spending category.</li>
              <li>
                Each category has an emission factor, expressed as kilograms of
                CO₂-equivalent per ₹100 spent.
              </li>
              <li>
                The estimate is the amount divided by 100, multiplied by that
                factor.
              </li>
              <li>
                Monthly totals are the sum of a month&apos;s transactions, shown as a
                trend.
              </li>
              <li>
                When a Climatiq API key is configured, the same spend is looked
                up against a standards-aligned provider instead; every
                transaction records which source produced its figure, and any
                lookup failure falls back to the static table.
              </li>
            </ol>
          </div>

          {/*
            The worked example from the project proposal, reproduced so a
            reviewer can check the arithmetic rather than take it on trust.
          */}
          <div className="card-quiet">
            <p className="mb-2 text-sm font-bold">Worked example</p>
            <p className="text-sm text-ink-soft">
              ₹2,000 spent on fuel, at 2.5 kg CO₂e per ₹100, gives{" "}
              <strong className="text-ink">50 kg CO₂e</strong>. That figure is an
              inference from a spending category, not a measurement.
            </p>
          </div>

          <div className="card-quiet">
            <p className="mb-2 text-sm font-bold">Where the factors come from</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
              <li>
                <strong className="text-ink">Electricity</strong> is based on
                India&apos;s Central Electricity Authority CO₂ Baseline Database.
              </li>
              <li>
                <strong className="text-ink">Fuel and travel</strong> come from
                published lifecycle emission estimates of passenger transport.
              </li>
              <li>
                Every other factor is an indicative order-of-magnitude estimate
                and is labelled as one in the interface.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Trust score methodology. */}
      <Card>
        <CardHeader title="Trust score" action={<Pill status="neutral">Scored 0-100</Pill>} />

        <div className="flex flex-col gap-4">
          <p className="leading-relaxed text-ink-soft text-pretty">
            FinLeaf has no credit-bureau history for a new user, so the score is
            computed from how the account is actually used. Eight behavioural
            features are read from the platform&apos;s own records — regular saving,
            on-time bill payments, consistent activity, account age, group
            participation, balance stability, monthly transaction volume and
            prior repayment behaviour.
          </p>

          <div className="card-quiet">
            <p className="mb-2 text-sm font-bold">What the score is</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
              <li>
                A 0-100 number, produced by a model served from the ML service,
                or from an explicit rule set when that service is unavailable.{" "}
                <strong className="text-ink">
                  The interface states which one produced a score
                </strong>{" "}
                rather than presenting both as a model.
              </li>
              <li>
                Scored with the logistic-regression scorecard or the
                gradient-boosted tree, on the same eight features.
              </li>
              <li>
                Deliberately free of protected attributes — no gender, religion,
                caste or age bracket — so the model cannot discriminate on a
                proxy for any of them.
              </li>
              <li>
                Explained to the user as per-factor contributions, so a score is
                never an unexplainable verdict.
              </li>
            </ul>
          </div>

          <div className="card-quiet">
            <p className="mb-2 text-sm font-bold">What it is not</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
              <li>
                Not a validated credit model. It is trained on synthetic
                behavioural data, because no labelled repayment data for Indian
                micro-lending is publicly available.
              </li>
              <li>
                Not a lending decision. Loan limits are a separate, explicit
                product policy applied to the score.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Anomaly detection. */}
      <Card>
        <CardHeader title="Anomaly detection" action={<Pill status="neutral">Screening only</Pill>} />
        <div className="flex flex-col gap-3">
          <p className="leading-relaxed text-ink-soft text-pretty">
            Unusual payments are screened with an isolation forest, an
            unsupervised method, because genuinely fraudulent transactions are
            too rare to train a classifier on reliably. A flagged payment is
            surfaced to the user —{" "}
            <strong className="text-ink">it is never blocked</strong>. A payment
            that is genuinely theirs must still be able to go through.
          </p>
          <p className="leading-relaxed text-ink-soft text-pretty">
            The features examined are the amount, the hour of the day, repeated
            payments to the same recipient, whether the recipient is new, and how
            unusual the spending category is for that account.
          </p>
        </div>
      </Card>

      {/* Data handling. */}
      <Card>
        <CardHeader title={t("home.privacy.title")} />
        <p className="leading-relaxed text-ink-soft text-pretty">
          {t("home.privacy.body")}
        </p>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
          <li>No government ID numbers, card numbers or bank credentials.</li>
          <li>Passwords hashed with bcrypt at cost 12.</li>
          <li>
            One-time codes and session tokens stored only as HMAC digests, with a
            secret held in the environment rather than the database.
          </li>
          <li>
            Security-relevant and money-relevant events are recorded in an
            append-only audit log.
          </li>
        </ul>
      </Card>

      <p className="text-sm text-ink-faint">
        {t("home.legal")} ·{" "}
        <Link href="/" className="font-semibold underline">
          {t("error.backHome")}
        </Link>
      </p>
    </main>
  );
}
