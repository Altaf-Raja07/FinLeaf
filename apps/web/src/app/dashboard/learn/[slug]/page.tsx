import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { getLessonDetail } from "../curriculum";
import { LessonQuiz } from "../LessonQuiz";

/**
 * One lesson: the reading, then the quiz.
 *
 * The paragraphs are set large and short on purpose — the content is written for
 * a first-time account holder reading on a phone, and a wall of small text is
 * what stops them. The quiz follows immediately rather than behind a link, so
 * finishing the lesson is one scroll away.
 */

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const lesson = await getLessonDetail(slug, user.id, locale);

  if (!lesson) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("learn.lessonNotFound")} />
        <EmptyState
          title={t("learn.lessonNotFound")}
          body="Check the lesson list and open it again."
          action={
            <Link href="/dashboard/learn" className="btn btn-primary no-underline">
              {t("learn.backToLessons")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/learn"
        className="text-sm font-semibold underline"
      >
        <span aria-hidden="true">← </span>
        {t("learn.backToLessons")}
      </Link>

      <PageHeader
        eyebrow={lesson.categoryLabel}
        title={lesson.title}
        subtitle={lesson.summary}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill status="neutral">{t("learn.minutes", { minutes: lesson.minutes })}</Pill>
            {lesson.completed ? <Pill status="good">{t("learn.completed")}</Pill> : null}
          </div>
        }
      />

      <Card className="flex flex-col gap-4">
        {lesson.body.map((paragraph, index) => (
          <p key={index} className="text-lg leading-relaxed text-pretty">
            {paragraph}
          </p>
        ))}
      </Card>

      {lesson.quizId && lesson.questions.length > 0 ? (
        <Card>
          <CardHeader
            title={t("learn.quiz")}
            subtitle={t("learn.quizSubmit")}
          />
          <LessonQuiz
            quizId={lesson.quizId}
            questions={lesson.questions}
            locale={locale}
          />
        </Card>
      ) : (
        <Alert tone="info">This lesson has no questions yet.</Alert>
      )}

      {lesson.nextSlug ? (
        <Link
          href={`/dashboard/learn/${lesson.nextSlug}`}
          className="btn btn-secondary no-underline self-start"
        >
          {t("learn.nextLesson")}
        </Link>
      ) : null}
    </div>
  );
}
