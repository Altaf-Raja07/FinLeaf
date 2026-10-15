import type { Metadata } from "next";
import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";
import { Card, CardHeader, ButtonLink } from "@/components/ui";
import { translator } from "@/lib/server-utils";

/**
 * About.
 *
 * The project and the people, complementing `/methodology`, which covers where
 * the numbers come from. Everything on this page is a fact from the project
 * proposal: the institution, the team, the scope. There is deliberately no
 * invented support email or contact form — this project has no production
 * operation behind it, and a fake contact address would be worse than saying so.
 */

export const metadata: Metadata = {
  title: "About",
  description:
    "FinLeaf is a student mini project at IIIT Dharwad: banking for financial inclusion and carbon-conscious spending.",
};

// From the project proposal. Proper nouns, so they are not translated.
const TEAM = [
  { name: "Altaf Raja", roll: "23BCS011" },
  { name: "Alok Kumar Das", roll: "23BCS010" },
  { name: "Ankit Kumar Keshari", roll: "23BCS015" },
  { name: "Deependra Kumar Singh", roll: "23BCS039" },
];

export default async function AboutPage() {
  const { t } = await translator();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <LeafMark className="h-9 w-9 text-leaf-700" />
        <span className="text-lg font-bold tracking-tight">FinLeaf</span>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          {t("about.title")}
        </h1>
        <p className="leading-relaxed text-ink-soft text-pretty">
          {t("about.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader title={t("about.project.title")} />
        <p className="leading-relaxed text-ink-soft text-pretty">
          {t("about.project.body")}
        </p>
      </Card>

      <Card>
        <CardHeader title={t("about.scope.title")} />
        <p className="leading-relaxed text-ink-soft text-pretty">
          {t("about.scope.body")}
        </p>
      </Card>

      <Card>
        <CardHeader title={t("about.team.title")} subtitle={t("about.team.body")} />
        <ul className="mt-2 flex flex-col divide-y divide-rule">
          {TEAM.map((member) => (
            <li
              key={member.roll}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
            >
              <span className="font-semibold">{member.name}</span>
              <span className="field-help font-mono">{member.roll}</span>
            </li>
          ))}
        </ul>
        <p className="field-help mt-3">{t("about.supervisor")}</p>
      </Card>

      <Card>
        <CardHeader title={t("about.methodology.title")} />
        <p className="leading-relaxed text-ink-soft text-pretty">
          {t("about.methodology.body")}
        </p>
        <div className="mt-4">
          <ButtonLink href="/methodology" variant="secondary">
            {t("about.methodology.link")}
          </ButtonLink>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("about.contact.title")} />
        <p className="leading-relaxed text-ink-soft text-pretty">
          {t("about.contact.body")}
        </p>
      </Card>

      <p className="field-help">
        <Link href="/" className="font-semibold underline">
          {t("nav.home")}
        </Link>
      </p>
    </main>
  );
}
