import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAnomalyAlerts } from "@/lib/screens";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, IconTile, Notice, Pill } from "@/components/ui";
import { AlertReview } from "@/components/alert-review";
import { CategoryIcon, ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Activity to review.
 *
 * The Isolation Forest flagged these; the user confirms or disputes them. Nothing
 * is ever blocked or reversed: the proposal is explicit that the model informs
 * rather than prevents, and the copy on this page says so.
 */

const STATUS_META: Record<string, { label: string; tone: "leaf" | "danger" | "amber" }> = {
  open: { label: "Needs review", tone: "amber" },
  confirmed: { label: "Confirmed by you", tone: "leaf" },
  disputed: { label: "Disputed", tone: "danger" },
};

export default async function AlertsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const alerts = await getAnomalyAlerts(user.id);
  const open = alerts.filter((a) => a.status === "open");
  const resolved = alerts.filter((a) => a.status !== "open");

  return (
    <AppShell pathname="/accounts" userName={user.fullName} alerts={open.length}>
      <PageHeader
        title="Activity to review"
        subtitle="We noticed something unusual. Only you can confirm it."
      />

      {alerts.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing needs review"
            body="When the model spots an unusual payment, it will appear here for you to confirm."
          />
        </Card>
      ) : (
        <>
          <Card className="border-l-4 border-l-amber bg-amber-soft/40 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-amber">
                <ShieldIcon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold">Possible unusual activity</h2>
                <p className="mt-1 text-[14px] text-muted">
                  {open.length} {open.length === 1 ? "payment needs" : "payments need"} your
                  confirmation. Your money was not blocked and nothing has been moved.
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-4 flex flex-col gap-3">
            {open.map((alert) => (
              <AlertReview key={alert.id} alert={alert} />
            ))}
          </div>
        </>
      )}

      {resolved.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          <div className="px-5 pt-5">
            <h2 className="text-[17px] font-semibold">Earlier reviews</h2>
          </div>
          <ul>
            {resolved.map((alert) => {
              const meta = STATUS_META[alert.status] ?? STATUS_META.confirmed;
              return (
                <li
                  key={alert.id}
                  className="flex items-center gap-3.5 border-b border-border px-5 py-3.5 last:border-b-0"
                >
                  <IconTile tone="neutral">
                    <CategoryIcon category={alert.category ?? "transfer"} size={17} />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{alert.merchant ?? "Transaction"}</p>
                    <p className="truncate text-[13px] text-muted">{alert.reasons.join(" · ")}</p>
                  </div>
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mt-4">
        <Notice tone="neutral">
          Anomaly detection runs on your own transaction history. It informs you and never blocks a
          payment, because only you can tell a genuine payment from an unfamiliar one.
        </Notice>
      </div>
    </AppShell>
  );
}