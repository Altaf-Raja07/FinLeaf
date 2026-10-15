import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Alert, Field, Button, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { formatDate } from "@/lib/i18n";
import { currentUser } from "@/lib/auth/session";
import { listMyCircles, listJoinableCircles, listVouches } from "@/lib/groups";
import { VouchButton } from "./VouchButton";
import { createCircleAction, joinCircleAction } from "./actions";

/**
 * Community trust circles.
 *
 * The honest copy on this page matters more than the feature itself. A circle
 * mirrors a microfinance self-help group: a small number of people who know each
 * other. Its effect on a trust score is indirect — the score reads actual
 * participation, so vouching for a dormant stranger changes nothing. Saying so
 * keeps the feature from becoming a metric to game.
 */

export default async function CirclesPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  const [mine, joinable, vouches] = await Promise.all([
    listMyCircles(user.id),
    listJoinableCircles(user.id, user.village),
    listVouches(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("circles.title")}
        subtitle={t("circles.subtitle")}
        action={
          <Pill status="neutral">
            {t("circles.vouchGiven")} {vouches.given.length} · {t("circles.vouchReceived")}{" "}
            {vouches.received.length}
          </Pill>
        }
      />

      <Alert tone="info">
        {t("circles.noteIndirect")}
      </Alert>

      {mine.length === 0 ? (
        <EmptyState
          title={t("circles.empty")}
          body={t("circles.emptyHelp")}
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <section className="flex flex-col gap-4">
          {mine.map(({ circle, role, joinedAt }) => (
            <Card as="li" key={circle.id} className="flex flex-col gap-4">
              <CardHeader
                title={circle.name}
                subtitle={`${circle.village} · ${t("circles.members", { count: circle.members.length })} · ${t("circles.joinedAt", { date: formatDate(joinedAt, locale) })}`}
                action={
                  <Pill status="neutral">
                    {role === "ADMIN" ? t("circles.role.admin") : t("circles.role.member")}
                  </Pill>
                }
              />

              <ul className="flex flex-col divide-y divide-rule">
                {circle.members.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-semibold">
                        {member.isMe ? t("misc.you") : member.name}
                      </span>
                      <span className="field-help">
                        {member.role === "ADMIN" ? t("circles.role.admin") : t("circles.role.member")}
                      </span>
                    </span>

                    {!member.isMe ? (
                      <VouchButton
                        circleId={circle.id}
                        toUserId={member.userId}
                        toName={member.name}
                        canVouch
                        reason={t("circles.vouched", { name: member.name })}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      )}

      {/* Join an existing circle in the same village. */}
      {joinable.length > 0 ? (
        <Card>
          <CardHeader title={t("circles.joinTitle")} />
          <ul className="flex flex-col divide-y divide-rule">
            {joinable.map((circle) => (
              <li key={circle.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold">{circle.name}</span>
                  <span className="field-help">
                    {circle.village} · {t("circles.members", { count: circle.memberCount })}
                  </span>
                </span>
                <form action={joinCircleAction.bind(null, circle.id)}>
                  <Button type="submit" variant="secondary">
                    {t("circles.join")}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Start one. */}
      <Card>
        <CardHeader title={t("circles.create")} />
        <form action={createCircleAction} className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <Field label={t("circles.circleName")} htmlFor="circle-name">
            <input id="circle-name" name="name" type="text" maxLength={80} className="input" required minLength={2} />
          </Field>
          <Field label={t("circles.village")} htmlFor="circle-village">
            <input
              id="circle-village"
              name="village"
              type="text"
              defaultValue={user.village}
              maxLength={80}
              className="input"
              required
              minLength={2}
            />
          </Field>
          <Button type="submit">{t("circles.create")}</Button>
        </form>
      </Card>
    </div>
  );
}

