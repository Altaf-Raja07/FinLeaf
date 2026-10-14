import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  BellRing,
  Leaf,
  MessagesSquare,
  Mic,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ButtonLink, Card, CardHeader, Pill } from "@/components/ui";
import { LeafMark } from "@/components/LeafMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";

/**
 * Public landing page.
 *
 * Every figure on this page is a cited fact about the world (from the World Bank
 * Findex 2025 survey) or a statement about what the product does. Never a
 * product metric: there is nothing to show a visitor, because they have no
 * account. The previous prototype put a made-up balance and a made-up carbon
 * figure on this screen; both are gone, and the page is stronger for saying
 * nothing it cannot support.
 */

export default async function HomePage() {
  const { t, locale } = await translator();

  const user = await currentUser();
  if (user) redirect("/dashboard");

  const stats = [
    { value: "1.3 billion", label: t("home.stats.unbanked"), icon: Users },
    { value: "55%", label: t("home.stats.unbankedWomen"), icon: Users },
    { value: "52%", label: t("home.stats.poorest"), icon: Users },
    { value: "62%", label: t("home.stats.primaryEd"), icon: Users },
  ];

  const features = [
    {
      icon: Banknote,
      title: t("home.features.bankingTitle"),
      body: t("home.features.bankingBody"),
    },
    {
      icon: ShieldCheck,
      title: t("home.features.creditTitle"),
      body: t("home.features.creditBody"),
    },
    {
      icon: Leaf,
      title: t("home.features.carbonTitle"),
      body: t("home.features.carbonBody"),
    },
    {
      icon: BellRing,
      title: t("home.features.greenTitle"),
      body: t("home.features.greenBody"),
    },
    {
      icon: MessagesSquare,
      title: t("home.features.inclusionTitle"),
      body: t("home.features.inclusionBody"),
    },
    {
      icon: Mic,
      title: t("home.features.trustTitle"),
      body: t("home.features.trustBody"),
    },
  ];

  return (
    <main className="flex-1">
      {/* Hero. */}
      <section className="border-b border-rule bg-gradient-to-b from-leaf-50 to-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14 sm:py-20">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <LeafMark className="h-10 w-10 text-leaf-700" />
              <span className="text-xl font-bold tracking-tight">FinLeaf</span>
            </Link>
            <LanguageSwitcher
              activeLocale={locale}
              labels={{ title: t("nav.language"), ariaLabel: t("nav.language") }}
            />
          </div>

          <div className="flex flex-col gap-5">
            <p className="text-xs font-bold uppercase tracking-widest text-leaf-700">
              {t("home.eyebrow")}
            </p>

            <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t("home.titleLead")}{" "}
              <span className="text-leaf-700">{t("home.titleEmphasis")}</span>{" "}
              {t("home.titleTail")}
            </h1>

            <p className="max-w-2xl text-lg leading-relaxed text-ink-soft text-pretty">
              {t("home.subtitle")}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="/sign-in" className="px-6">
                {t("home.heroPrimary")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/methodology" variant="secondary">
                {t("home.heroSecondary")}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Why this exists. */}
      <section className="border-b border-rule" aria-labelledby="why-heading">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14">
          <div className="flex flex-col gap-2">
            <h2 id="why-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("home.stats.explainTitle")}
            </h2>
            <p className="max-w-3xl leading-relaxed text-ink-soft text-pretty">
              {t("home.stats.explain")}
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card as="li" key={stat.label} className="flex flex-col gap-2">
                <stat.icon className="h-5 w-5 text-leaf-700" aria-hidden="true" />
                <p className="text-3xl font-bold tracking-tight tnum">{stat.value}</p>
                <p className="field-help text-pretty">{stat.label}</p>
              </Card>
            ))}
          </ul>
        </div>
      </section>

      {/* Features. */}
      <section className="border-b border-rule bg-surface-sunken" aria-labelledby="features-heading">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14">
          <div className="flex flex-col gap-2">
            <h2 id="features-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("home.features.title")}
            </h2>
            <p className="text-ink-soft">{t("home.features.subtitle")}</p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card as="li" key={feature.title} className="flex flex-col gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-leaf-50 text-leaf-700">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="font-bold">{feature.title}</h3>
                <p className="field-help text-pretty">{feature.body}</p>
              </Card>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works. */}
      <section className="border-b border-rule" aria-labelledby="how-heading">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("home.how.title")}
          </h2>

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { title: t("home.how.onboard"), body: t("home.how.onboardBody") },
              { title: t("home.how.use"), body: t("home.how.useBody") },
              { title: t("home.how.build"), body: t("home.how.buildBody") },
              { title: t("home.how.borrow"), body: t("home.how.borrowBody") },
              { title: t("home.how.green"), body: t("home.how.greenBody") },
            ].map((step) => (
              <Card as="li" key={step.title} className="flex flex-col gap-2">
                <h3 className="font-bold text-leaf-800">{step.title}</h3>
                <p className="field-help text-pretty">{step.body}</p>
              </Card>
            ))}
          </ol>
        </div>
      </section>

      {/* Two problems, honestly framed. */}
      <section className="border-b border-rule bg-surface-sunken" aria-labelledby="problems-heading">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14">
          <div className="flex flex-col gap-2">
            <h2 id="problems-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("home.problems.title")}
            </h2>
            <p className="text-ink-soft">{t("home.problems.subtitle")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <h3 className="font-bold">{t("home.problems.exclusion")}</h3>
              <p className="field-help text-pretty">{t("home.problems.exclusionBody")}</p>
            </Card>
            <Card className="flex flex-col gap-3">
              <h3 className="font-bold">{t("home.problems.environment")}</h3>
              <p className="field-help text-pretty">{t("home.problems.environmentBody")}</p>
            </Card>
          </div>
        </div>
      </section>

      {/* What this platform does not do. */}
      <section className="border-b border-rule" aria-labelledby="limits-heading">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <CardHeader title={t("home.privacy.title")} />
              <p className="field-help text-pretty">{t("home.privacy.body")}</p>
            </Card>
            <Card className="flex flex-col gap-3">
              <CardHeader title={t("home.demo.title")} />
              <p className="field-help text-pretty">{t("home.demo.body")}</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to action. */}
      <section className="bg-leaf-800 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("home.cta.title")}</h2>
          <p className="text-leaf-100">{t("home.cta.body")}</p>
          <ButtonLink href="/sign-in" variant="secondary">
            {t("home.cta.button")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>

      {/* Footer. */}
      <footer className="bg-ink text-sm text-leaf-100">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <LeafMark className="h-7 w-7 text-leaf-400" />
              <span className="font-bold text-white">FinLeaf</span>
            </div>
            <p className="text-leaf-200">{t("home.footer.tagline")}</p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              <li>
                <Link href="/about" className="text-leaf-100 hover:text-white">
                  {t("home.footer.about")}
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="text-leaf-100 hover:text-white">
                  {t("home.features.link")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-leaf-100 hover:text-white">
                  {t("home.footer.contact")}
                </Link>
              </li>
            </ul>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-leaf-800 pt-6">
            <p className="text-leaf-200">{t("home.footer.project")}</p>
            <Pill className="bg-leaf-900 text-leaf-100">{t("home.legal")}</Pill>
          </div>
        </div>
      </footer>
    </main>
  );
}
