import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { TxCategory } from "@/generated/prisma/enums";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { formatDateTime, formatMoney, formatCo2e } from "@/lib/i18n";
import { PageHeader, Card, CardHeader, EmptyState, Pill, Alert, cn } from "@/components/ui";
import { HistoryFilters } from "./HistoryFilters";
import { ExportCsvButton } from "./ExportCsvButton";
import { confirmAnomalyAction } from "./history-actions";

/**
 * Transaction history.
 *
 * Filters are read from the URL rather than kept in component state, so a
 * filtered view is linkable and survives a reload or a share — the difference
 * between "show me electricity bills last month" being repeatable and being a
 * one-off.
 */

const PAGE_SIZE = 20;

export default async function HistoryPage({
  searchParams,
}: PageProps<"/dashboard/history">) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  const params = await searchParams;
  const query = (params.q as string | undefined)?.trim();
  const rawCategory = params.category as string | undefined;
  // Unvalidated, an unknown category reaches Prisma as an invalid enum value
  // and 500s the page. `transactionFilterSchema` covers the same shape.
  const category = isTxCategory(rawCategory) ? rawCategory : undefined;
  const from = params.from as string | undefined;
  const to = params.to as string | undefined;
  const minAmount = params.min ? Number(params.min) : undefined;
  const maxAmount = params.max ? Number(params.max) : undefined;
  const flaggedOnly = params.flagged === "true";
  // `?page=2` arriving twice (or as a repeated key) would otherwise make
  // `Number()` produce NaN and silently snap the user back to page 1.
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  // Both directions, because a transfer appears on both sides of a ledger.
  const baseWhere = {
    OR: [{ fromUserId: user.id }, { toUserId: user.id }],
    ...(category ? { category } : {}),
    ...(from || to ? { createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      } } : {}),
    ...(minAmount || maxAmount
      ? { amount: { ...(minAmount ? { gte: minAmount } : {}), ...(maxAmount ? { lte: maxAmount } : {}) } }
      : {}),
    ...(query ? { note: { contains: query, mode: "insensitive" as const } } : {}),
  };

  // `?flagged=true` has to actually *filter*. It used to only raise a banner,
  // so "See details" on the dashboard alert landed on the user's entire
  // unfiltered history — and the banner counted every transaction they had.
  const where = flaggedOnly
    ? { AND: [baseWhere, { anomalyFlag: { is: { resolved: false } } }] }
    : baseWhere;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        anomalyFlag: { select: { id: true, resolved: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("history.title")}
        subtitle={t("history.subtitle")}
        action={<ExportCsvButton where={JSON.stringify(where)} />}
      />

      {flaggedOnly ? (
        <Alert tone="warning" title={t("transfer.wasThisYou")}>
          {t("transfer.flagBody", { count: total })}{" "}
          <Link href="/dashboard/history" className="font-semibold underline">
            {t("action.dismiss")}
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={t("history.filters")}
          subtitle={t("history.results", { count: total })}
          action={<Pill status="neutral">{t("history.page", { page, total: totalPages })}</Pill>}
        />
        <HistoryFilters
          initial={{
            q: query ?? "",
            category: category ?? "",
            from: from ?? "",
            to: to ?? "",
            min: params.min as string | undefined,
            max: params.max as string | undefined,
          }}
          locale={locale}
          flagged={flaggedOnly}
        />
      </Card>

      {transactions.length === 0 ? (
        <EmptyState
          title={t("history.empty")}
          body={
            total === 0 ? t("history.emptyFirst") : t("history.emptyFiltered")
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-rule rounded-card border border-rule">
            {transactions.map((txn) => {
              const isOut = txn.fromUserId === user.id;
              const counterparty = isOut ? txn.toUser?.name : txn.fromUser?.name;
              const flagged = txn.anomalyFlag;

              return (
                <li key={txn.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {isOut ? t("history.debit") : t("history.credit")}
                      </p>
                      <Pill>{txn.category.replace(/_/g, " ").toLowerCase()}</Pill>
                      {flagged ? (
                        <div className="flex items-center gap-2">
                          <Pill status={flagged.resolved ? "neutral" : "warn"}>
                            {flagged.resolved ? t("admin.flagResolved") : t("transfer.wasThisYou")}
                          </Pill>
                          {!flagged.resolved && isOut ? (
                            <form action={confirmAnomalyAction.bind(null, flagged.id)}>
                              <button
                                type="submit"
                                className="text-xs font-semibold text-leaf-700 underline hover:text-leaf-800"
                              >
                                {t("transfer.confirmSelf")}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <p className="field-help">
                      {formatDateTime(txn.createdAt, locale)}
                      {counterparty ? ` · ${counterparty}` : ""}
                    </p>
                    {txn.note ? <p className="field-help">{txn.note}</p> : null}
                    <p className="field-help font-mono text-[0.6875rem]">
                      {txn.reference}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-lg font-bold tnum ${
                        isOut ? "text-ink" : "text-leaf-700"
                      }`}
                    >
                      {isOut ? "−" : "+"}
                      {formatMoney(txn.amount.toString())}
                    </p>
                    {txn.co2eKg && Number(txn.co2eKg) > 0 ? (
                      <p className="field-help">
                        {t("transfer.estCarbon", { value: formatCo2e(Number(txn.co2eKg), locale) })}
                      </p>
                    ) : null}
                    {txn.greenPoints > 0 ? (
                      <p className="field-help text-leaf-700">
                        +{txn.greenPoints} {t("dashboard.greenPoints").toLowerCase()}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <nav aria-label={t("history.pagination")} className="flex items-center justify-between gap-3">
              <PaginationLink
                href={buildQuery(params, page - 1)}
                disabled={page <= 1}
                label={t("history.previous")}
              />
              <span className="field-help">
                {t("history.page", { page, total: totalPages })}
              </span>
              <PaginationLink
                href={buildQuery(params, page + 1)}
                disabled={page >= totalPages}
                label={t("history.next")}
              />
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * One pagination control.
 *
 * At a boundary this renders a `<span>`, not a disabled link. `pointer-events-none`
 * only stops the mouse: the link stays in the tab order and stays activatable by
 * keyboard, so a "Previous" on page 1 was still focusable and still went
 * somewhere on Enter.
 */
function PaginationLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  const className = "btn btn-secondary";

  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(className, "opacity-50")}>
        {label}
      </span>
    );
  }

  return (
    <Link href={href as Route} className={className}>
      {label}
    </Link>
  );
}

/**
 * Rebuilds the query string with the page parameter replaced.
 *
 * Returns a leading `?` so the result is a complete relative href. It used to
 * return a leading `&` and be concatenated after an explicit `?page=`, which
 * emitted `?page=2&…&page=2`: a duplicate key that `Number()` reads as NaN,
 * which then snapped every page of history back to page 1.
 */
function buildQuery(
  params: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") search.set(key, first);
  }
  search.set("page", String(page));
  return `?${search.toString()}`;
}

/** Narrows an untrusted query value to a real `TxCategory`. */
function isTxCategory(value: string | undefined): value is TxCategory {
  return TX_CATEGORIES.includes(value as TxCategory);
}

const TX_CATEGORIES: readonly TxCategory[] = [
  "GROCERIES", "FUEL", "TRAVEL_PUBLIC", "TRAVEL_PRIVATE", "ELECTRICITY",
  "DINING", "EDUCATION", "HEALTHCARE", "ELECTRONICS", "CLOTHING", "HOUSING",
  "RENT", "SALARY", "TRANSFER", "BILL_PAYMENT", "RECHARGE", "LOAN", "SAVINGS",
  "GREEN_REWARD", "OFFSET", "OTHER",
];

