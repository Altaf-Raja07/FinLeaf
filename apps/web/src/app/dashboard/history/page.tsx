import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { TxCategory } from "@/generated/prisma/enums";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { formatDateTime, formatMoney, formatCo2e } from "@/lib/i18n";
import { PageHeader, Card, CardHeader, EmptyState, Pill, Alert } from "@/components/ui";
import { HistoryFilters } from "./HistoryFilters";
import { ExportCsvButton } from "./ExportCsvButton";

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
  const category = params.category as string | undefined;
  const from = params.from as string | undefined;
  const to = params.to as string | undefined;
  const minAmount = params.min ? Number(params.min) : undefined;
  const maxAmount = params.max ? Number(params.max) : undefined;
  const flagged = params.flagged === "true";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  // Both directions, because a transfer appears on both sides of a ledger.
  const where = {
    OR: [{ fromUserId: user.id }, { toUserId: user.id }],
    ...(category ? { category: category as TxCategory } : {}),
    ...(from || to ? { createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      } } : {}),
    ...(minAmount || maxAmount
      ? { amount: { ...(minAmount ? { gte: minAmount } : {}), ...(maxAmount ? { lte: maxAmount } : {}) } }
      : {}),
    ...(query ? { note: { contains: query, mode: "insensitive" as const } } : {}),
  };

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

      {flagged ? (
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
        />
      </Card>

      {transactions.length === 0 ? (
        <EmptyState
          title={t("history.empty")}
          body={
            total === 0
              ? "Your transactions appear here once you make one."
              : "No transactions match these filters."
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
                        <Pill status={flagged.resolved ? "neutral" : "warn"}>
                          {flagged.resolved ? t("admin.flagResolved") : t("admin.resolveFlag")}
                        </Pill>
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
            <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
              <Link
                href={`?page=${page - 1}${buildQuery(params, page - 1)}`}
                aria-disabled={page <= 1}
                className={`btn btn-secondary ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {t("history.previous")}
              </Link>
              <span className="field-help">
                {t("history.page", { page, total: totalPages })}
              </span>
              <Link
                href={`?page=${page + 1}${buildQuery(params, page + 1)}`}
                aria-disabled={page >= totalPages}
                className={`btn btn-secondary ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                {t("history.next")}
              </Link>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Rebuilds the query string with the page parameter replaced. */
function buildQuery(params: Record<string, string | string[] | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (typeof value === "string") search.set(key, value);
  }
  search.set("page", String(page));
  return `&${search.toString()}`;
}

