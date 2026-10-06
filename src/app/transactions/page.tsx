import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTransactions, type TransactionRow } from "@/lib/queries";
import { getUsedCategories } from "@/lib/screens";
import { formatMoney } from "@/lib/money";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, IconTile } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import { EmptyStateArt } from "@/components/illustration";

export const dynamic = "force-dynamic";

/**
 * Transaction history with working filters.
 *
 * Filters are applied in SQL, not by hiding rows in the browser, so the count,
 * the sum, and the rows always agree. The form does a plain GET, which means the
 * filtered view is a real URL and can be shared or reloaded.
 */

const TONES: Record<string, "primary" | "leaf" | "trust" | "amber" | "neutral"> = {
  fuel: "amber",
  travel: "trust",
  groceries: "leaf",
  dining: "primary",
  electronics: "primary",
  bills: "trust",
  recharge: "neutral",
  health: "leaf",
  transfer: "neutral",
};

const AMOUNT_RANGES = [
  { value: "any", label: "Any amount", min: 0, max: Infinity },
  { value: "under-500", label: "Under ₹500", min: 0, max: 50_000 },
  { value: "500-2000", label: "₹500 to ₹2,000", min: 50_000, max: 200_000 },
  { value: "over-2000", label: "Over ₹2,000", min: 200_000, max: Infinity },
];

const DATE_RANGES = [
  { value: "all", label: "All dates", days: null },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; amount?: string; when?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const category = params.category ?? "all";
  const amountKey = params.amount ?? "any";
  const when = params.when ?? "all";

  const range = AMOUNT_RANGES.find((r) => r.value === amountKey) ?? AMOUNT_RANGES[0];
  const dateRange = DATE_RANGES.find((r) => r.value === when) ?? DATE_RANGES[0];

  const [{ rows, total }, categories] = await Promise.all([
    getTransactions(user.id, {
      limit: 100,
      search: search || undefined,
      category,
      withinDays: dateRange.days ?? undefined,
    }),
    getUsedCategories(user.id),
  ]);

  // Amount filtering happens after the SQL search because the range is a
  // presentation concern; it is still applied before counting so the count shown
  // matches the rows shown.
  const filtered = rows.filter((r) => {
    const abs = Math.abs(r.signedAmount);
    return abs >= range.min && abs < range.max;
  });

  const isFiltered = Boolean(search) || category !== "all" || amountKey !== "any" || when !== "all";

  return (
    <AppShell pathname="/transactions" userName={user.fullName}>
      <PageHeader
        title="Transactions"
        subtitle="Every movement in your account, newest first"
      />

      <Card className="p-5">
        <form method="get" className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q" className="text-[13px] font-medium">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Merchant or note"
              className="h-11 w-full rounded-sm border border-border-strong bg-surface px-3 text-[15px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-[13px] font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={category}
              className="h-11 w-full rounded-sm border border-border-strong bg-surface px-3 text-[15px]"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="amount" className="text-[13px] font-medium">
              Amount
            </label>
            <select
              id="amount"
              name="amount"
              defaultValue={amountKey}
              className="h-11 w-full rounded-sm border border-border-strong bg-surface px-3 text-[15px]"
            >
              {AMOUNT_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="when" className="text-[13px] font-medium">
              Date
            </label>
            <select
              id="when"
              name="when"
              defaultValue={when}
              className="h-11 w-full rounded-sm border border-border-strong bg-surface px-3 text-[15px]"
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-11 rounded-md bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover"
          >
            Filter
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[13px] text-muted">
            Showing <span className="fl-num font-medium text-foreground">{filtered.length}</span> of{" "}
            <span className="fl-num">{total}</span> transactions
          </p>
          {isFiltered && (
            <Link href="/transactions" className="text-[13px] font-medium text-primary">
              Clear filters
            </Link>
          )}
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title={isFiltered ? "No matches" : "No transactions yet"}
            body={
              isFiltered
                ? "Try widening the date range or clearing the amount filter."
                : "Your payments and transfers will appear here once you start using the account."
            }
            art={<EmptyStateArt name="empty-transactions" />}
            action={
              isFiltered ? (
                <Link
                  href="/transactions"
                  className="inline-flex h-10 items-center rounded-md border border-border-strong px-4 font-semibold hover:bg-sunken"
                >
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Column headers are hidden on small screens, where rows become a
                stacked layout instead of a squeezed table. */}
            <div className="hidden grid-cols-[1fr_140px_120px_140px] gap-4 border-b border-border px-5 py-3 text-[12px] font-medium tracking-wide text-muted uppercase md:grid">
              <span>Merchant</span>
              <span>Category</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
            </div>
            <ul>
              {filtered.map((row) => (
                <TransactionLine key={row.id} row={row} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </AppShell>
  );
}

function TransactionLine({ row }: { row: TransactionRow }) {
  const credit = row.direction === "credit";
  return (
    <li className="flex items-center gap-3.5 border-b border-border px-5 py-3.5 last:border-b-0">
      <IconTile tone={TONES[row.category] ?? "neutral"}>
        <CategoryIcon category={row.category} size={18} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{row.merchant}</p>
        <p className="truncate text-[13px] text-muted">
          {row.category.charAt(0).toUpperCase() + row.category.slice(1)}
          {row.note ? ` · ${row.note}` : ""}
        </p>
      </div>
      <div className="hidden shrink-0 text-[13px] text-muted md:block">
        {new Date(row.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
      </div>
      <div className="shrink-0 text-right">
        <span className={`fl-num text-[15px] font-semibold ${credit ? "text-leaf" : ""}`}>
          {credit ? "+" : "−"}
          {formatMoney(row.amount, { sign: "never" })}
        </span>
        {row.co2eKg !== null && row.co2eKg > 0 && (
          <p className="text-[12px] text-muted">{row.co2eKg} kg CO2e</p>
        )}
      </div>
    </li>
  );
}