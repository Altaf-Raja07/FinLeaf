import Link from "next/link";
import { redirect } from "next/navigation";
import { NavBar } from "./NavBar";
import { translator } from "@/lib/server-utils";
import { currentUser, touchSession } from "@/lib/auth/session";
import { unreadCount } from "@/lib/notify";

/**
 * Authenticated shell.
 *
 * The session is re-checked here even though `proxy.ts` already redirects
 * unauthenticated visitors: the proxy matches on path, and only this layout —
 * with an actual database read — knows whether the cookie is a live session.
 * The same check is repeated in every server action and route handler.
 */

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Slides the session forward once it is within a day of lapsing, so an active
  // user is never signed out mid-task.
  await touchSession();

  const { t, locale } = await translator();
  const unread = await unreadCount(user.id);

  return (
    <div className="flex min-h-full flex-col">
      <NavBar
        locale={locale}
        name={user.name}
        role={user.role}
        unread={unread}
        labels={{
          signOut: t("nav.signOut"),
          language: t("nav.language"),
          menu: t("nav.menu"),
          close: t("nav.close"),
          skip: t("nav.skipToContent"),
        }}
      />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>

      <footer className="mt-auto border-t border-rule py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>{t("home.footer.project")}</p>
          <Link href="/methodology" className="hover:text-ink-soft">
            {t("carbon.methodology")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
