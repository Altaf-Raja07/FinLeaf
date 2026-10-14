import { redirect } from "next/navigation";
import { Alert, Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/i18n";
import { listFamilyGroups } from "./family-action";
import { CreateFamilyForm } from "./CreateFamilyForm";
import { InviteMemberForm } from "./InviteMemberForm";
import { LeaveGroupButton, RemoveMemberButton, ToggleSpendButton } from "./MemberActions";

/**
 * Family / shared-visibility groups.
 *
 * The honesty problem this page has to solve is the word "spend". The schema has
 * a `canSpend` flag and the interface must show it, because a household that
 * agreed on permissions is owed to see them. But FinLeaf implements no shared
 * spending: there is no linked account, no delegation and no second card. So the
 * flag is labelled as the agreement it is and never as a capability, and the
 * banner at the top of the page says the same thing once, plainly, before
 * anyone reaches for the toggle.
 */

export default async function FamilyPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const groups = await listFamilyGroups(user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("family.title")} subtitle={t("family.subtitle")} />

      <Alert tone="warning" title={t("family.canSpend")}>
        {/* Written out rather than keyed: nothing in the locale files says this,
            and it is the most important sentence on the page. */}
        FinLeaf does not implement shared spending. This permission records what
        your household agreed; it does not let anyone move money through FinLeaf.
        Nobody can spend from your account here — you send money to them yourself,
        as a normal transfer.
      </Alert>

      <Card>
        <CardHeader title={t("family.create")} subtitle={t("family.inviteHelp")} />
        <CreateFamilyForm labels={{ name: t("family.name"), submit: t("family.create") }} />
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold tracking-tight">{t("family.members")}</h2>

        {groups.length === 0 ? (
          <EmptyState
            title={t("family.empty")}
            body={t("family.subtitle")}
            icon={<span className="text-3xl" aria-hidden="true">🏠</span>}
          />
        ) : (
          groups.map((group) => (
            <Card as="li" key={group.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold tracking-tight truncate">
                    {group.name}
                  </h3>
                  <p className="field-help">
                    {t("family.members", { count: group.members.length + 1 })} ·{" "}
                    {formatDate(group.createdAt, locale)}
                  </p>
                </div>
                <Pill status={group.isOwner ? "good" : "neutral"}>
                  {group.isOwner ? t("family.owner") : t("family.member")}
                </Pill>
              </div>

              <ul className="flex flex-col divide-y divide-rule">
                {/* The owner is not a membership row — they are the account
                    holder — so they are rendered from the group, not the list. */}
                <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {group.ownerName}
                      {group.ownerId === user.id ? (
                        <span className="field-help"> ({t("circles.you")})</span>
                      ) : null}
                    </p>
                    <p className="field-help">{t("family.owner")}</p>
                  </div>
                  <Pill status="good">{t("family.canSpend")}</Pill>
                </li>

                {group.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {member.name}
                        {member.userId === user.id ? (
                          <span className="field-help"> ({t("circles.you")})</span>
                        ) : null}
                      </p>
                      <p className="field-help">
                        {t("circles.memberSince", {
                          date: formatDate(member.joinedAt, locale),
                        })}
                        {/* Only the owner is shown a phone number: they invited
                            the person, so it is not new information, while a
                            fellow member has no reason to hold it. */}
                        {member.phone ? ` · ${member.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Pill status={member.canSpend ? "warn" : "neutral"}>
                        {member.canSpend ? t("family.canSpend") : t("family.spendOnly")}
                      </Pill>

                      {group.isOwner ? (
                        <>
                          <ToggleSpendButton
                            groupId={group.id}
                            memberId={member.id}
                            canSpend={member.canSpend}
                            labels={{
                              giveSpend: "Give spending permission",
                              makeViewOnly: "Make view only",
                              updated: t("family.spendUpdated"),
                            }}
                          />
                          <RemoveMemberButton
                            groupId={group.id}
                            memberId={member.id}
                            labels={{
                              remove: t("family.remove"),
                              removed: t("family.removed"),
                            }}
                          />
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              {!group.isOwner && group.myCanSpend === false ? (
                <Alert tone="info">{t("family.cannotSpend")}</Alert>
              ) : null}

              {group.isOwner ? (
                <div className="flex flex-col gap-4 rounded-card border border-rule bg-surface-sunken p-3">
                  <CardHeader title={t("family.invite")} subtitle={t("family.inviteHelp")} />
                  <InviteMemberForm
                    groupId={group.id}
                    labels={{
                      invite: t("family.invite"),
                      inviteHelp: t("family.inviteHelp"),
                      phone: t("family.enterPhone"),
                      allowSpend: t("family.changeSpend"),
                      allowSpendHelp:
                        "Optional. FinLeaf has no shared spending, so this records what you agreed — it is not a way for them to spend.",
                      linkTitle: "Share this invite link",
                      linkHelpSms:
                        "FinLeaf's SMS channel carries one-time verification codes only, so the link was not sent by SMS.",
                      linkHelpNoSms:
                        "This deployment has no SMS provider set up, so the link was not sent by SMS.",
                      copy: t("action.copy"),
                      copied: t("action.copied"),
                    }}
                  />

                  {group.pendingInvites.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-bold">{t("family.inviteSent")}</p>
                      <ul className="flex flex-col divide-y divide-rule">
                        {group.pendingInvites.map((invite) => (
                          <li
                            key={invite.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
                          >
                            <span className="tnum">{invite.phone}</span>
                            <span className="field-help">
                              Expires {formatDate(invite.expiresAt, locale)} ·{" "}
                              {invite.canSpend ? t("family.canSpend") : t("family.spendOnly")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <LeaveGroupButton
                    groupId={group.id}
                    labels={{ leave: t("family.leave"), left: t("family.left") }}
                  />
                </div>
              )}
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
