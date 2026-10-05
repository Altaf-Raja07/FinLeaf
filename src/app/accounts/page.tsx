import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAccounts } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, IconTile, Pill } from "@/components/ui";
import { PiggyIcon, WalletIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Accounts and wallet detail.
 *
 * Shows one card per account with its own balance, so the dashboard's "across
 * 2 accounts" figure is visibly the sum of real rows rather than a label.
 */

const KIND_META = {
  wallet: { icon: WalletIcon, tone: "primary" as const, label: "Spendable now" },
  savings: { icon: PiggyIcon, tone: "leaf" as const, label: "Set aside" },
  group: { icon: PiggyIcon, tone: "trust" as const, label: "Shared with household" },
};

export default async function AccountsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const accounts = await getAccounts(user.id);
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <AppShell pathname="/accounts" userName={user.fullName}>
      <PageHeader title="Accounts" subtitle="Every account you hold with FinLeaf" />

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">Total across all accounts</span>
          <Pill>Estimated</Pill>
        </div>
        <p className="fl-num mt-3 text-[34px] leading-none font-semibold tracking-tight md:text-[40px]">
          {formatMoney(total, { sign: "never" })}
        </p>
      </Card>

      {accounts.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            title="No accounts yet"
            body="An account is created for you when you finish signing in."
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {accounts.map((account) => {
            const meta = KIND_META[account.kind];
            const Icon = meta.icon;
            return (
              <Card key={account.id} className="p-5">
                <div className="flex items-start gap-3">
                  <IconTile tone={meta.tone}>
                    <Icon size={19} />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{account.label}</p>
                    <p className="text-[13px] text-muted">{meta.label}</p>
                  </div>
                  <Pill tone="neutral">{account.kind}</Pill>
                </div>
                <p className="fl-num mt-4 text-[26px] leading-none font-semibold">
                  {formatMoney(account.balance, { sign: "never" })}
                </p>
                <div className="mt-4 flex gap-2">
                  <Link
                    href="/transfer"
                    className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover"
                  >
                    Send money
                  </Link>
                  <Link
                    href="/transactions"
                    className="inline-flex h-10 items-center rounded-md border border-border-strong px-4 text-[14px] font-semibold hover:bg-sunken"
                  >
                    See activity
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4 p-5">
        <p className="text-[13px] text-muted">
          These are simulated accounts inside this prototype. No real bank holds your money here, and
          these balances are not insured by any real authority.
        </p>
      </Card>
    </AppShell>
  );
}