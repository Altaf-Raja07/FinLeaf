"use client";

import { useState, useActionState } from "react";
import { Alert, Button, Pill, cn } from "@/components/ui";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { submitQuizAction, type QuizActionState } from "./quiz-action";
import type { LessonQuestion } from "./curriculum";

/**
 * Answer a lesson's quiz.
 *
 * The questions are rendered from props, but the correct answers are not sent to
 * the browser at all: the server action grades from the database and returns
 * only whether each question was right. Everything else — the explanation, the
 * score, the points, the badges won — comes back in that same response.
 */

interface Props {
  quizId: string;
  questions: LessonQuestion[];
  locale: Locale;
}

const initialState: QuizActionState = {};

export function LessonQuiz({ quizId, questions, locale }: Props) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  // Results are shown only once a submission has been made, so retaking clears
  // them without needing to reset the action's own state.
  const [revealed, setRevealed] = useState(false);
  const [state, formAction, pending] = useActionState(submitQuizAction, initialState);

  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;
  const allAnswered = answeredCount === questions.length;
  const graded = revealed && state?.results !== undefined;
  const score = state?.score ?? 0;
  const total = state?.total ?? 0;

  return (
    <form
      action={formAction}
      onSubmit={() => setRevealed(true)}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="quizId" value={quizId} />

      {questions.map((question, index) => {
        const result = graded
          ? state.results?.find((entry) => entry.quizId === question.id)
          : undefined;

        return (
          <fieldset key={question.id} className="flex flex-col gap-2">
            <legend className="font-bold">
              {index + 1}. {question.question}
            </legend>

            <div className="flex flex-col gap-1.5">
              {question.options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  className={cn(
                    "flex items-start gap-2.5 rounded-input border p-3 text-sm leading-relaxed",
                    answers[question.id] === optionIndex
                      ? "border-leaf-600 bg-leaf-50"
                      : "border-rule",
                  )}
                >
                  <input
                    type="radio"
                    name={`answer-${question.id}`}
                    value={optionIndex}
                    checked={answers[question.id] === optionIndex}
                    onChange={() =>
                      setAnswers((previous) => ({ ...previous, [question.id]: optionIndex }))
                    }
                    className="mt-0.5"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>

            {result ? (
              <div className="flex flex-col items-start gap-1.5">
                <Pill status={result.correct ? "good" : "bad"}>
                  {result.correct ? t("learn.quizCorrect") : t("learn.quizIncorrect")}
                </Pill>
                <p className="field-help text-pretty">{question.explanation}</p>
              </div>
            ) : null}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={!allAnswered}>
          {t("learn.quizSubmit")}
        </Button>
        <span className="field-help tnum">
          {answeredCount} / {questions.length}
        </span>
        {!allAnswered ? (
          <span className="field-help">Answer every question to check your answers.</span>
        ) : null}
      </div>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {graded ? (
        <div className="flex flex-col gap-3">
          <Alert tone={score === total ? "success" : "info"} title={t("learn.quizScore", { score, total })}>
            {state.points ? t("learn.pointsEarned", { points: state.points }) : null}
          </Alert>

          {state.badges?.map((badge) => (
            <Alert key={badge.slug} tone="success" title={t("learn.badgeEarned")}>
              {badge.name}
            </Alert>
          ))}

          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRevealed(false);
                setAnswers({});
              }}
            >
              {t("learn.quizRetake")}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
