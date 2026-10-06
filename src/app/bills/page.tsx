import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAccounts } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, IconTile, Notice } from "@/components/ui";
import { BillPayForm } from "@/components/bill-form";
import { BillIcon, PhoneIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Bill payments and recharges. */

const TYPES = [
  { key: "bills", label: "Electricity", icon: BillIcon },
  { key: "bills", label: "Water", icon: BillIcon },
  { key: "recharge", label: "Mobile", icon: PhoneIcon },
  { key: "recharge", label: "DTH", icon: PhoneIcon },
  { key: "bills", label: "Gas", icon: BillIcon },
  { key: "recharge", label: "Bus pass", icon: PhoneIcon },
];

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const preselect = params.category === "recharge" ? "recharge" : "bills";
  const accounts = await getAccounts(user.id);
  const wallet = accounts.find((a) => a.kind === "wallet");

  return (
    <AppShell pathname="/bills" userName={user.fullName}>
      <PageHeader title="Pay a bill or recharge" subtitle="Choose a biller, enter the amount, and confirm" />

      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {TYPES.map((t, i) => (
          <Link
            key={`${t.label}-${i}`}
            href={`/bills?category=${t.key}`}
            className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors ${
              preselect === t.key
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface hover:bg-sunken"
            }`}
          >
            <IconTile tone={preselect === t.key ? "primary" : "neutral"} size="sm">
              <t.icon size={17} />
            </IconTile>
            <span className="text-[13px] font-semibold">{t.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="px-5 pt-5 text-[17px] font-semibold">Payment details</h2>
          {wallet ? (
            <BillPayForm
              defaultCategory={preselect}
              balancePaise={wallet.balance}
            />
          ) : (
            <p className="p-5 text-[14px] text-muted">You need a wallet before you can pay a bill.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Available to spend</h2>
          <p className="fl-num mt-2 text-[30px] leading-none font-semibold">
            {formatMoney(wallet?.balance ?? 0, { sign: "never" })}
          </p>
          <p className="mt-2 text-[13px] text-muted">Main wallet</p>
          <div className="mt-4">
            <Notice tone="neutral">
              Nothing leaves this system. No biller is contacted and no payment network is
              involved.
            </Notice>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}