import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LeafMark } from "@/components/LeafMark";
import { Alert, Button, ButtonLink, Card, CardHeader } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { findInviteByToken } from "@/lib/groups";
import { acceptInviteAction } from "../dashboard/family/family-actions";

/**
 * Invite acceptance.
 *
 * A public page, because a family invite has to be openable by someone who has
 * not signed in yet — that is the whole point of the link. The token is looked
 * up by digest, so the raw value is never stored and never logged.
 *
 * A bad token renders an explanation rather than an error page: an expired link
 * is an ordinary thing to happen, and the person on the other end deserves to
 * know why it did not work.
 */

export const metadata: Metadata = {
  title: "Family invite",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await translator();
  const params = await searchParams;
  const token = params.token;
  const error = params.error;

  if (typeof token !== "string" || token.length < 16) {
    return <InvalidInvite heading={t("family.inviteInvalid")} />;
  }

  const invite = await findInviteByToken(token);

  if (!invite) {
    return <InvalidInvite heading={t("family.inviteInvalid")} />;
  }

  if (invite.accepted) {
    const { t } = await translator();
    return (
      <InviteShell>
        <Alert tone="info">{t("family.inviteUsed")}</Alert>
        <ButtonLink href="/dashboard/family" className="mt-4 no-underline">
          {t("family.title")}
        </ButtonLink>
      </InviteShell>
    );
  }

  if (invite.expired) {
    return <InvalidInvite heading={t("family.inviteExpired")} />;
  }

  if (typeof error === "string") {
    return <InvalidInvite heading={error} />;
  }

  const user = await currentUser();

  // Signing in must return them here, not to the dashboard, or the invite is
  // lost the moment they authenticate.
  if (!user) {
    const next = encodeURIComponent(`/invite?token=${token}`);
    redirect(`/sign-in?next=${next}`);
  }

  return (
    <InviteShell>
      <Card>
        <CardHeader
          title={t("family.inviteHeading", { group: invite.groupName })}
          subtitle={`${t("family.inviteHeadingNote")}${
            invite.canSpend ? ` ${t("family.inviteCanSpend")}` : ""
          }`}
        />
        <form action={acceptInviteAction.bind(null, token)}>
          <Button type="submit">{t("family.acceptInvite")}</Button>
        </form>
      </Card>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <LeafMark className="h-9 w-9 text-leaf-700" />
        <span className="text-lg font-bold tracking-tight">FinLeaf</span>
      </div>
      {children}
      <p className="field-help">
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>{" "}
        to a different account.
      </p>
    </main>
  );
}

async function InvalidInvite({ heading }: { heading: string }) {
  const { t } = await translator();
  return (
    <InviteShell>
      <Alert tone="warning" title={heading}>
        {t("family.inviteExpiredNote")}
      </Alert>
      <ButtonLink href="/sign-in" className="no-underline">
        Sign in
      </ButtonLink>
    </InviteShell>
  );
}
