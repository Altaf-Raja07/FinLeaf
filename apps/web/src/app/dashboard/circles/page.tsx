import { redirect } from "next/navigation";
import { Alert, Card, CardHeader, EmptyState, PageHeader, Pill, Stat } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/i18n";
import { listCircles } from "./circle-action";
import { CreateCircleForm } from "./CreateCircleForm";
import { JoinCircleList } from "./JoinCircleList";
import { VouchButton } from "./VouchButton";

/**
 * Trust circles.
 *
 * The two things this page has to be honest about, stated rather than implied:
 *
 *  1. These groups mirror how microfinance self-help groups already work —
 *     a handful of people from one village who vouch for each other because
 *     they know each other. FinLeaf did not invent the mechanism.
 *  2. A vouch is not a score. It moves nothing by itself. The only path from
 *     circle participation to the trust score is the group-activity feature,
 *     which is derived from the groups a user actually belongs to. Anyone
 *     promising otherwise is selling a fake credit history.
 *
 * The copy on this page says both, in those words, because the incentive to
 * imply the second is exactly what makes trust-circle features go wrong.
 */

export default async function CirclesPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const { circles, joinable, vouchesGiven, vouchesReceived } = await listCircles(
    user.id,
    user.village,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("circles.title")} subtitle={t("circles.subtitle")} />

      <Alert tone="info" title={t("circles.feedsTrust")}>
        {/* No key covers the "indirect" part of this, so it is written out
            plainly here rather than left to the subtitle to imply. */}
        A vouch does not add points to anyone&rsquo;s trust score. It is one
        neighbour confirming another, and it reaches the score only through the
        group-activity measure, which comes from the groups you actually belong
        to. Joining or leaving a circle is what changes it.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t("circles.vouchGiven")}
          value={`${vouchesGiven}`}
          hint={t("circles.feedsTrust")}
        />
        <Stat
          label={t("circles.vouchReceived")}
          value={`${vouchesReceived}`}
          hint={t("circles.emptyHelp")}
        />
        <Stat
          label={t("circles.mine")}
          value={`${circles.length}`}
          hint={t("circles.emptyHelp")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("circles.create")} subtitle={t("circles.emptyHelp")} />
          <CreateCircleForm
            defaultVillage={user.village}
            labels={{
              name: t("circles.circleName"),
              namePlaceholder: "Rampur self-help group",
              village: t("circles.village"),
              submit: t("circles.create"),
            }}
          />
        </Card>

        <Card>
          <CardHeader
            title={t("circles.join")}
            subtitle={`${t("circles.village")}: ${user.village}`}
          />
          <JoinCircleList
            circles={joinable}
            labels={{
              join: t("circles.join"),
              members: t("circles.members"),
              empty: t("circles.empty"),
            }}
          />
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold tracking-tight">{t("circles.mine")}</h2>

        {circles.length === 0 ? (
          <EmptyState
            title={t("circles.empty")}
            body={t("circles.emptyHelp")}
            icon={<span className="text-3xl" aria-hidden="true">🤝</span>}
          />
        ) : (
          circles.map((circle) => (
            <Card as="li" key={circle.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold tracking-tight truncate">
                    {circle.name}
                  </h3>
                  <p className="field-help">
                    {circle.village} ·{" "}
                    {t("circles.members", { count: circle.members.length })} ·{" "}
                    {t("circles.vouchGiven")} {circle.vouchesGiven} ·{" "}
                    {t("circles.vouchReceived")} {circle.vouchesReceived}
                  </p>
                </div>
                <Pill status="neutral">
                  {t("circles.members", { count: circle.members.length })}
                </Pill>
              </div>

              <ul className="flex flex-col divide-y divide-rule">
                {circle.members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {member.name}{" "}
                        {member.isMe ? (
                          <span className="field-help">({t("circles.you")})</span>
                        ) : null}
                      </p>
                      <p className="field-help">
                        {t("circles.memberSince", {
                          date: formatDate(member.joinedAt, locale),
                        })}
                      </p>
                    </div>

                    {member.isMe ? null : (
                      <VouchButton
                        circleId={circle.id}
                        toUserId={member.userId}
                        alreadyVouched={member.vouchedByMe}
                        label={
                          member.vouchedByMe
                            ? t("circles.vouched", { name: member.name })
                            : t("circles.vouch")
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
