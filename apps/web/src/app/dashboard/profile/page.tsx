import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, Pill, Stat, Button } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/i18n";
import { ProfileForm } from "./ProfileForm";
import {
  listSessions,
  signOutEverywhere,
} from "./profile-actions";
import { PasswordForm } from "./PasswordForm";
import { TrustBreakdown } from "./TrustBreakdown";

/**
 * Profile and scores.
 *
 * The trust-score factor breakdown sits here rather than only on the loans page,
 * because a user who is not currently borrowing still deserves to be able to
 * find out why their score is what it is. A score stored in a column with no way
 * to see its inputs is an uneffectable verdict, and the platform's claim about
 * explaining its decisions only holds if the explanation is always reachable.
 */

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  const [sessions, snapshot, accounts, counts] = await Promise.all([
    listSessions(user.id),
    prisma.trustScoreSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { contributions: true, score: true, model: true, createdAt: true },
    }),
    prisma.account.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: { number: true, balance: true, openedAt: true },
      orderBy: { openedAt: "asc" },
    }),
    Promise.all([
      prisma.transaction.count({ where: { fromUserId: user.id, status: "COMPLETED" } }),
      prisma.loan.count({ where: { userId: user.id, status: { in: ["ACTIVE", "OVERDUE"] } } }),
      prisma.savingsGoal.count({ where: { userId: user.id, archivedAt: null } }),
      prisma.userBadge.count({ where: { userId: user.id } }),
      prisma.circleMember.count({ where: { userId: user.id } }),
    ]),
  ]);

  const [transactionCount, loanCount, goalCount, badgeCount, circleCount] = counts;

  const factors = Array.isArray(snapshot?.contributions)
    ? (snapshot.contributions as Array<{ factor: string; label: string; points: number; detail: string }>)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.memberSince", { date: formatDate(user.createdAt, locale) })}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("profile.trustScore")}
          value={user.trustScore}
          hint={snapshot ? new Date(snapshot.createdAt).toLocaleDateString("en-IN") : undefined}
        />
        <Stat label={t("profile.sustainabilityScore")} value={user.sustainability} />
        <Stat label={t("profile.greenPoints")} value={user.greenPoints} />
        <Stat
          label={t("profile.accountNumber")}
          value={accounts[0]?.number ?? "—"}
          hint={accounts[0] ? formatMoney(accounts[0].balance.toString()) : undefined}
          className="text-lg"
        />
      </div>

      {/* Personal details. */}
      <Card>
        <CardHeader title={t("profile.account")} />
        <ProfileForm
          initial={{
            name: user.name,
            phone: user.phone,
            village: user.village,
            email: user.email ?? "",
            preferredLang: user.preferredLang,
          }}
        />
      </Card>

      {/* The score, explained. */}
      <Card>
        <CardHeader
          title={t("dashboard.trustScore")}
          subtitle={t("loans.explanation")}
          action={
            snapshot ? (
              <Pill status="neutral">
                {snapshot.model === "fallback-rules"
                  ? "Rule-based fallback"
                  : snapshot.model}
              </Pill>
            ) : null
          }
        />

        {factors.length === 0 ? (
          <p className="field-help">
            Your score has not been computed yet. It updates as you use your
            account.
          </p>
        ) : (
          <>
            <TrustBreakdown factors={factors} score={snapshot?.score ?? user.trustScore} />
            <p className="field-help mt-4">
              {snapshot?.model === "fallback-rules"
                ? "This breakdown comes from the transparent rule set, because the scoring service was unavailable when the score was computed. The interface always labels which one produced a score."
                : "These contributions are stored with your score, so a score from months ago still explains itself."}
            </p>
          </>
        )}
      </Card>

      {/* Account statistics — real counts, not estimates. */}
      <Card>
        <CardHeader title={t("profile.statistics")} />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: t("history.results", { count: transactionCount }), value: transactionCount },
            { label: t("loans.active"), value: loanCount },
            { label: t("savings.title"), value: goalCount },
            { label: t("learn.myBadges"), value: badgeCount },
            { label: t("nav.circles"), value: circleCount },
            { label: t("dashboard.paperless"), value: user.paperlessSheets },
          ].map((item) => (
            <div key={item.label} className="card-quiet flex justify-between gap-3">
              <dt className="field-help">{item.label}</dt>
              <dd className="font-bold tnum">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Security: password and sessions. */}
      <Card>
        <CardHeader title={t("profile.security")} />
        <div className="flex flex-col gap-6">
          <PasswordForm />

          <div>
            <p className="field-label">{t("profile.sessions")}</p>
            {sessions.length === 0 ? (
              <p className="field-help">No other devices are signed in.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {sessions.map((session) => (
                  <li key={session.id} className="card-quiet flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {session.isCurrent ? t("profile.sessionThis") : (session.userAgent ?? t("state.empty"))}
                      </span>
                      <span className="field-help">
                        {t("profile.lastSeen", { date: formatDate(session.lastSeenAt, locale) })}
                      </span>
                    </span>
                    {session.isCurrent ? <Pill status="good">{t("misc.you")}</Pill> : null}
                  </li>
                ))}
              </ul>
            )}

            {/*
              Warns the user that their current session ends too. Siya
              silently logging them out is a disorienting surprise.
            */}
            <form action={signOutEverywhere} className="mt-3">
              <Button type="submit" variant="secondary">
                {t("profile.signOutEverywhere")}
              </Button>
            </form>
            <p className="field-help mt-2">{t("profile.signOutEverywhereNote")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
