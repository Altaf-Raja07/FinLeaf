import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAccounts } from "@/lib/queries";
import { getRecipients } from "@/lib/screens";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, Notice } from "@/components/ui";
import { TransferForm } from "@/components/transfer-form";
import { ChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function TransferPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [accounts, recipients] = await Promise.all([getAccounts(user.id), getRecipients(user.id)]);

  const wallet = accounts.find((a) => a.kind === "wallet");
  // Only people who map to a real seeded user can receive a transfer, so the
  // dropdown cannot offer a destination that would fail on submit.
  const sendable = recipients.filter((r) => r.userId !== null);

  const previousRecipients = sendable;

  return (
    <AppShell pathname="/transfer" userName={user.fullName}>
      <PageHeader title="Send money" subtitle="Transferring between FinLeaf accounts is instant" />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <h2 className="px-5 pt-5 text-[17px] font-semibold">New transfer</h2>
          {wallet ? (

            <TransferForm recipients={sendable} balancePaise={wallet.balance} />
          ) : (
            <EmptyState title="No wallet" body="You need a wallet before you can send money." />
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Recent recipients</h2>
            <Link href="/transactions" className="text-[13px] font-medium text-primary">
              See all
            </Link>
          </div>

          {previousRecipients.length === 0 ? (
            <EmptyState
              title="No recipients yet"
              body="People you send money to will appear here for next time."
            />
          ) : (
            <ul className="mt-3">
              {previousRecipients.map((r, index) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-[13px] font-semibold text-muted"
                  >
                    {r.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{r.name}</span>
                    <span className="block text-[13px] text-muted">{r.phone}</span>
                  </span>
                  {index === 0 && (
                    <span className="fl-num shrink-0 text-[13px] text-muted">
                      {formatMoney(120_000, { sign: "never" })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Notice tone="neutral">
          Transfers only move simulated balances between demo accounts in this prototype. Nothing
          leaves the database, and no payment network is involved.
        </Notice>
      </div>
    </AppShell>
  );
}