import { redirect } from "next/navigation";
import { Home } from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Alert, Field, Button, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { formatDate } from "@/lib/i18n";
import { currentUser } from "@/lib/auth/session";
import { listMyFamilyGroups } from "@/lib/groups";
import { createFamilyAction, leaveGroupAction, removeMemberAction, setSpendPermissionAction } from "./family-actions";
import { InviteForm } from "./InviteForm";

/**
 * Family group.
 *
 * Shared *visibility*, not shared spending. The permission flag is recorded on
 * the household record, but the platform does not implement a joint account: no
 * member can move money from the holder's balance. The page says so where the
 * permission is shown rather than letting the label imply otherwise.
 */

export default async function FamilyPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const groups = await listMyFamilyGroups(user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("family.title")} subtitle={t("family.subtitle")} />

      <Alert tone="info">{t("family.notSharedSpending")}</Alert>

      {groups.owned.length === 0 && groups.memberOf.length === 0 ? (
        <EmptyState
          title={t("family.empty")}
          body={t("family.noteVisibility")}
          icon={<Home className="h-8 w-8" />}
        />
      ) : null}

      {/*
        Groups are split into owned and member-of because the two are different
        authority levels, and mixing them would present permissions a member does
        not have.
      */}
      {groups.owned.map((group) => (
        <Card as="section" key={group.id} className="flex flex-col gap-4">
          <CardHeader
            title={group.name}
            subtitle={t("family.owner")}
            action={<Pill status="good">{t("family.owner")}</Pill>}
          />

          <ul className="flex flex-col divide-y divide-rule">
            {group.members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-semibold">
                    {member.isMe ? t("misc.you") : member.name}
                  </span>
                  <span className="field-help">
                    {member.isMe
                      ? t("family.accountHolder")
                      : member.canSpend
                        ? t("family.canSpend")
                        : t("family.spendOnly")}
                  </span>
                </span>

                <form action={setSpendPermissionAction} className="flex items-center gap-2">
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="membershipId" value={member.id} />
                  <input type="hidden" name="canSpend" value={member.canSpend ? "false" : "true"} />
                  <Button type="submit" variant="ghost" disabled={member.isMe}>
                    {member.canSpend ? t("family.revokeSpend") : t("family.grantSpend")}
                  </Button>
                </form>

                <form action={removeMemberAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="membershipId" value={member.id} />
                  <Button type="submit" variant="ghost" disabled={member.isMe}>
                    {t("family.remove")}
                  </Button>
                </form>
              </li>
            ))}
          </ul>

          <InviteForm groupId={group.id} locale={locale} />

          {group.pendingInvites.length > 0 ? (
            <div>
              <p className="field-label">{t("family.pending")}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {group.pendingInvites.map((invite) => (
                  <li key={invite.id} className="field-help">
                    {invite.phone} — {t("family.expiresOn", { date: formatDate(invite.expiresAt, locale) })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ))}

      {groups.memberOf.map((group) => (
        <Card as="section" key={group.id} className="flex flex-col gap-3">
          <CardHeader
            title={group.name}
            subtitle={`${t("family.accountHolder")}: ${group.ownerName}`}
            action={
              <Pill status="neutral">
                {group.canSpend ? t("family.canSpend") : t("family.spendOnly")}
              </Pill>
            }
          />

          <form action={leaveGroupAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <Button type="submit" variant="ghost">
              {t("family.leave")}
            </Button>
          </form>
        </Card>
      ))}

      <Card>
        <CardHeader title={t("family.create")} />
        <form action={createFamilyAction} className="flex flex-wrap items-end gap-3">
          <Field label={t("family.name")} htmlFor="family-name" className="min-w-64 flex-1">
            <input id="family-name" name="name" type="text" maxLength={80} className="input" required minLength={2} />
          </Field>
          <Button type="submit">{t("family.create")}</Button>
        </form>
      </Card>
    </div>
  );
}

