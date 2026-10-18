import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Card, CardHeader, Alert, Pill } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { requireAdmin } from "@/lib/auth/guard";
import {
  listAgentsForAdmin,
  listAuditLogs,
  listUnresolvedFlags,
  listUsers,
  modelMetrics,
  systemHealth,
} from "@/lib/admin";
import { formatDateTime } from "@/lib/i18n";
import { deactivateAgentAction, resolveFlagAction } from "./admin-actions";
import { AgentForm } from "./AgentForm";
import { UserTable } from "./UserTable";

/**
 * Administration console.
 *
 * `requireAdmin()` reads the role from the database. The proxy cannot — it has no
 * per-request identity — so this is where administrator access is actually
 * granted, and a non-administrator reaching it gets a 403 rather than the page.
 */

export const metadata: Metadata = {
  title: "Administrator",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; village?: string }>;
}) {
  // Throws a 403 for anyone who is not an administrator, before any data is
  // read.
  const admin = await requireAdmin();

  const { t, locale } = await translator();
  const params = await searchParams;

  const query = typeof params.q === "string" ? params.q : "";
  const village = typeof params.village === "string" ? params.village : "";

  const [users, flags, metrics, health, agents, auditLogs] = await Promise.all([
    listUsers({ query: query || undefined, village: village || undefined, limit: 50 }),
    listUnresolvedFlags(20),
    modelMetrics(),
    systemHealth(),
    listAgentsForAdmin(),
    listAuditLogs(30),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("admin.title")}
        subtitle={t("admin.usersHelp")}
        action={
          <div className="flex flex-wrap gap-2">
            <Pill status={health.database ? "good" : "bad"}>
              {t("admin.database")}
            </Pill>
            <Pill status={health.ml ? "good" : "warn"}>{t("admin.mlService")}</Pill>
          </div>
        }
      />

      <Alert tone="info">
        You are signed in as{" "}
        <strong>
          {admin.name} ({admin.role})
        </strong>
        . The role is read from the database on every request, so it cannot be
        granted by editing a URL.
      </Alert>

      {/* Anomaly flags: a queue for review, not a list of blocked payments. */}
      <Card>
        <CardHeader
          title={t("admin.anomalies")}
          subtitle={t("transfer.wasThisYou")}
          action={
            <Pill status={flags.length > 0 ? "warn" : "neutral"}>{flags.length}</Pill>
          }
        />

        {flags.length === 0 ? (
          <p className="field-help">No transactions are waiting for review.</p>
        ) : (
          <table className="table mt-2">
            <thead>
              <tr>
                <th scope="col">{t("admin.reference")}</th>
                <th scope="col">{t("admin.users")}</th>
                <th scope="col">{t("admin.transactions")}</th>
                <th scope="col">{t("transfer.wasThisYou")}</th>
                <th scope="col">{t("admin.resolveFlag")}</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id}>
                  <th scope="row" className="font-mono text-xs">
                    {flag.transactionReference}
                  </th>
                  <td>{flag.userName}</td>
                  <td className="tnum">{flag.amount}</td>
                  <td>
                    {Array.isArray(flag.reasons)
                      ? (flag.reasons as string[]).join(", ")
                      : String(flag.reasons ?? "")}
                  </td>
                  <td>
                    <form action={resolveFlagAction.bind(null, flag.id)}>
                      <button type="submit" className="btn btn-ghost">
                        {t("admin.flagResolved")}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Model metrics — real figures, or an explicit "unavailable". */}
      <Card>
        <CardHeader
          title={t("admin.metrics")}
          subtitle={t("admin.metricsHelp")}
          action={<Pill status={metrics ? "good" : "warn"}>{t("admin.metricsLabel")}</Pill>}
        />

        {!metrics ? (
          <p className="field-help">{t("admin.mlUnavailable")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t("admin.metricsModel")}</th>
                  <th scope="col">{t("admin.metricsAccuracy")}</th>
                  <th scope="col">{t("admin.metricsPrecision")}</th>
                  <th scope="col">{t("admin.metricsRecall")}</th>
                  <th scope="col">{t("admin.metricsAuc")}</th>
                </tr>
              </thead>
              <tbody>
                {(["logistic_regression", "gradient_boosting"] as const).map((key) => {
                  const section = metrics[key];
                  return (
                    <tr key={key}>
                      <th scope="row" className="font-semibold">
                        {key === "logistic_regression"
                          ? "Logistic regression scorecard"
                          : "Gradient-boosted trees"}
                      </th>
                      <td className="tnum">{section.accuracy}</td>
                      <td className="tnum">{section.precision}</td>
                      <td className="tnum">{section.recall}</td>
                      <td className="tnum">{section.auc_roc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="field-help">{metrics.trained_on}</p>
          </div>
        )}
      </Card>

      {/* User search. */}
      <Card>
        <CardHeader
          title={t("admin.users")}
          subtitle={t("admin.usersHelp")}
          action={<Pill status="neutral">{t("admin.usersCount", { count: users.length })}</Pill>}
        />

        <form className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="field">
            <label className="field-label" htmlFor="admin-q">
              {t("admin.searchUsers")}
            </label>
            <input id="admin-q" name="q" type="search" defaultValue={query} className="input" />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="admin-village">
              {t("admin.chooseVillage")}
            </label>
            <input
              id="admin-village"
              name="village"
              type="text"
              defaultValue={village}
              className="input"
            />
          </div>

          <button type="submit" className="btn btn-secondary">
            {t("action.apply")}
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <UserTable
            users={users.map((user) => ({
              ...user,
              createdAt: user.createdAt.toISOString(),
            }))}
            adminId={admin.id}
            locale={locale}
          />
        </div>
      </Card>

      {/* Agent directory. Empty until the operator loads it, and the copy says
          so rather than shrugging at an empty table. */}
      <Card>
        <CardHeader
          title={t("admin.agents")}
          subtitle={t("admin.agentHelp")}
          action={
            <Pill status={agents.length > 0 ? "good" : "neutral"}>
              {agents.filter((a) => a.active).length} / {agents.length}
            </Pill>
          }
        />

        <AgentForm
          labels={{
            addAgent: t("admin.addAgent"),
            agentName: t("admin.agentName"),
            shopName: t("admin.shopName"),
            village: t("admin.chooseVillage"),
            agentPhone: t("admin.agentPhone"),
            latitude: t("admin.latitude"),
            longitude: t("admin.longitude"),
            openHours: t("admin.openHours"),
            agentHelp: t("admin.agentHelp"),
            phoneHelp: t("admin.agentPhoneHelp"),
          }}
        />

        {agents.length === 0 ? (
          <p className="field-help mt-4">{t("admin.agentsEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t("admin.agentName")}</th>
                  <th scope="col">{t("admin.shopName")}</th>
                  <th scope="col">{t("admin.chooseVillage")}</th>
                  <th scope="col">{t("admin.agentPhone")}</th>
                  <th scope="col">{t("admin.openHours")}</th>
                  <th scope="col">{t("admin.status")}</th>
                  <th scope="col">{t("action.apply")}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className={agent.active ? "" : "opacity-60"}>
                    <th scope="row" className="font-semibold">
                      {agent.name}
                    </th>
                    <td>{agent.shopName}</td>
                    <td>{agent.village}</td>
                    <td className="tnum">{agent.phone}</td>
                    <td>{agent.openHours}</td>
                    <td>
                      <Pill status={agent.active ? "good" : "neutral"}>
                        {agent.active ? t("admin.agentActive") : t("admin.agentInactive")}
                      </Pill>
                    </td>
                    <td>
                      {agent.active ? (
                        <form action={deactivateAgentAction.bind(null, agent.id)}>
                          <button type="submit" className="btn btn-ghost">
                            {t("admin.deactivateAgent")}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Audit log: every security- and money-relevant event, newest first. */}
      <Card>
        <CardHeader
          title={t("admin.auditLog")}
          subtitle={t("admin.auditHelp")}
          action={<Pill status="neutral">{auditLogs.length}</Pill>}
        />

        {auditLogs.length === 0 ? (
          <p className="field-help">{t("admin.auditEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t("admin.auditWhen")}</th>
                  <th scope="col">{t("admin.auditWho")}</th>
                  <th scope="col">{t("admin.auditAction")}</th>
                  <th scope="col">{t("admin.auditDetail")}</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap field-help">
                      {formatDateTime(entry.createdAt, locale)}
                    </td>
                    <td>{entry.user?.name ?? "—"}</td>
                    <td>
                      <span className="font-mono text-xs">
                        {entry.action.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="max-w-md">
                      <span className="field-help block truncate" title={JSON.stringify(entry.detail)}>
                        {entry.detail ? JSON.stringify(entry.detail) : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="field-help">
        Audit entries are written for every administrative action. See{" "}
        <Link href="/methodology">{t("carbon.methodology")}</Link> for what the
        platform does and does not do.
      </p>
    </div>
  );
}

