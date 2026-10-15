import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  Gift,
  GraduationCap,
  PiggyBank,
  Shield,
} from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { listNotifications } from "@/lib/notify";
import { formatDateTime } from "@/lib/i18n";
import { markAllReadAction, markReadAction } from "./notification-actions";
import type { NotificationType } from "@/generated/prisma/enums";

/**
 * Notifications.
 *
 * Every row here was written by an action the user took or by the platform
 * noticing something on their account. There are no marketing messages and no
 * seeded examples: an empty list in a fresh install is the honest empty state,
 * and the page says what will appear rather than showing a placeholder that
 * never resolves.
 *
 * Notifications are marked read, never deleted. A user who clears their list by
 * accident should still be able to find out what they missed.
 */

const ICONS: Record<NotificationType, typeof Bell> = {
  TRANSACTION: ArrowLeftRight,
  LOAN: Shield,
  SAVINGS: PiggyBank,
  REWARD: Gift,
  ANOMALY: AlertTriangle,
  SYSTEM: Bell,
  LESSON: GraduationCap,
};

const TYPE_KEYS: Record<NotificationType, string> = {
  TRANSACTION: "notifications.type.transaction",
  LOAN: "notifications.type.loan",
  SAVINGS: "notifications.type.savings",
  REWARD: "notifications.type.reward",
  ANOMALY: "notifications.type.anomaly",
  SYSTEM: "notifications.type.system",
  LESSON: "notifications.type.lesson",
};

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  // 50 is the page's scroll budget; the unread badge is the count that matters,
  // and it is computed separately in the layout.
  const notifications = await listNotifications(user.id, { limit: 50 });

  const unread = notifications.filter((item) => item.readAt === null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        action={
          unread.length > 0 ? (
            <form action={markAllReadAction}>
              <button type="submit" className="btn btn-secondary">
                {t("notifications.markAllRead")}
              </button>
            </form>
          ) : (
            <Pill status="neutral">{t("notifications.allRead")}</Pill>
          )
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title={t("notifications.empty")}
          body={t("notifications.emptyHelp")}
        />
      ) : (
        <Card>
          <CardHeader
            title={t("notifications.title")}
            subtitle={t("notifications.note")}
            action={
              unread.length > 0 ? (
                <Pill status="good">{t("notifications.unreadCount", { count: unread.length })}</Pill>
              ) : null
            }
          />

          <ul className="flex flex-col divide-y divide-rule">
            {notifications.map((item) => {
              const Icon = ICONS[item.type] ?? Bell;
              const isUnread = item.readAt === null;

              return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-start gap-3 py-4 ${
                    isUnread ? "" : "opacity-70"
                  }`}
                >
                  <span
                    className={`mt-0.5 rounded-lg p-2 ${
                      isUnread
                        ? "bg-leaf-50 text-leaf-700"
                        : "bg-surface-sunken text-ink-faint"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* The type is text, not only an icon: a colour and a
                          glyph are not readable to everybody. */}
                      <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                        {t(TYPE_KEYS[item.type])}
                      </span>
                      {isUnread ? (
                        <Pill status="good">{t("notifications.unreadLabel")}</Pill>
                      ) : null}
                      <span className="field-help">
                        {formatDateTime(item.createdAt, locale)}
                      </span>
                    </div>

                    <p className="mt-1 font-bold">{item.title}</p>
                    <p className="field-help text-pretty">{item.body}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="text-sm font-semibold text-leaf-700 underline"
                        >
                          {t("notifications.open")}
                        </Link>
                      ) : null}

                      {isUnread ? (
                        <form action={markReadAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="text-sm font-semibold text-ink-faint underline"
                          >
                            {t("notifications.markRead")}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="field-help">{t("notifications.note")}</p>
    </div>
  );
}
