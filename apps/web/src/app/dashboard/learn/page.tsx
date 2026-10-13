import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, GraduationCap, Trophy } from "lucide-react";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pill,
  ProgressBar,
  Stat,
} from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { badgeBoard, listLessonCategories } from "./curriculum";

/**
 * The financial-literacy curriculum.
 *
 * Lessons are grouped by module and each one links to its own page. "Completed"
 * means a quiz attempt was recorded for that lesson — reading the page is not
 * counted, because the point of the module is the check at the end of it.
 */

export default async function LearnPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  const [categories, board] = await Promise.all([
    listLessonCategories(user.id, locale),
    badgeBoard(user.id, locale),
  ]);

  const lessonCount = categories.reduce((sum, group) => sum + group.lessons.length, 0);
  const completedCount = categories.reduce((sum, group) => sum + group.completedCount, 0);
  const earnedBadges = board.badges.filter((badge) => badge.earned);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("learn.title")} subtitle={t("learn.subtitle")} />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t("learn.completed")}
          value={`${completedCount} / ${lessonCount}`}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <Stat
          label="Best quiz score"
          value={`${board.bestQuizPct}%`}
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <Stat
          label={t("learn.myBadges")}
          value={`${earnedBadges.length} / ${board.badges.length}`}
          icon={<Trophy className="h-4 w-4" />}
        />
      </section>

      {categories.length === 0 ? (
        <EmptyState title={t("state.empty")} body={t("learn.subtitle")} />
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map((group) => (
            <section key={group.category} className="flex flex-col gap-3">
              <CardHeader
                title={group.label}
                subtitle={t("learn.lessons", { count: group.lessons.length })}
              />

              <ul className="grid gap-3 sm:grid-cols-2">
                {group.lessons.map((lesson) => (
                  <li key={lesson.slug}>
                    <Link
                      href={`/dashboard/learn/${lesson.slug}`}
                      className="card flex h-full flex-col gap-2 no-underline transition-colors hover:bg-leaf-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-pretty">{lesson.title}</h3>
                        {lesson.completed ? (
                          <Pill status="good">{t("learn.completed")}</Pill>
                        ) : null}
                      </div>

                      <p className="field-help text-pretty">{lesson.summary}</p>

                      <p className="field-help tnum mt-auto">
                        {t("learn.minutes", { minutes: lesson.minutes })}
                        {" · "}
                        <span className="font-semibold">
                          {lesson.completed ? t("learn.continue") : t("learn.start")}
                        </span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title={t("learn.myBadges")} />
        {board.badges.length === 0 ? (
          <EmptyState title={t("learn.noBadges")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {board.badges.map((badge) => (
              <li
                key={badge.slug}
                className="card-quiet flex flex-col gap-2 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{badge.name}</p>
                  {badge.earned ? <Pill status="good">{t("learn.completed")}</Pill> : null}
                </div>

                <p className="field-help text-pretty">{badge.description}</p>

                {badge.earned || !badge.detail ? null : (
                  <ProgressBar
                    value={Math.round(badge.fraction * 100)}
                    max={100}
                    label={badge.detail}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
