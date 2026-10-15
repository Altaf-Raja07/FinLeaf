import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { listAgents } from "@/lib/agents";
import { AgentFinder } from "./AgentFinder";

/**
 * Nearby agent locator.
 *
 * This page is empty in a fresh install, and the empty state is the honest one
 * rather than a placeholder: the agent directory is supplied by the BC network
 * operator, because only they know who is authorised to take deposits. Two
 * things are deliberately absent — no map (a map of nothing is worse than a
 * list) and no sample entries (a fabricated agent would send a real person to a
 * stranger's phone number).
 */

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; village?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t } = await translator();
  const params = await searchParams;

  const query = typeof params.q === "string" ? params.q : "";
  const village = typeof params.village === "string" ? params.village : "";

  const agents = await listAgents({
    query: query || undefined,
    village: village || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("agents.title")} subtitle={t("agents.subtitle")} />

      {agents.length === 0 ? (
        <EmptyState
          title={t("agents.empty")}
          body={t("agents.emptyHelp")}
          icon={<MapPin className="h-8 w-8" />}
          action={
            <div className="max-w-md">
              <p className="field-help">{t("agents.operatorNote")}</p>
            </div>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader title={t("agents.search")} />
            <AgentFinder initialQuery={query} initialVillage={village} />
          </Card>

          <ul className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => (
              <Card as="li" key={agent.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">{agent.shopName}</h2>
                    <p className="field-help truncate">
                      {agent.name} · {agent.village}
                    </p>
                  </div>
                  <MapPin className="h-5 w-5 shrink-0 text-leaf-700" aria-hidden="true" />
                </div>

                <dl className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="field-help">{t("agents.hours")}</dt>
                    <dd>{agent.openHours}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="field-help">{t("agents.phone")}</dt>
                    <dd className="tnum">
                      <a href={`tel:${agent.phone}`} className="font-semibold">
                        {agent.phone}
                      </a>
                    </dd>
                  </div>
                </dl>

                {/* Directions open the user's own map app. */}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${agent.latitude}&mlon=${agent.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary mt-1 no-underline"
                >
                  {t("agents.directions")}
                </a>

                <p className="field-help">
                  {t("agents.contactNote", { shop: agent.shopName })}
                </p>
              </Card>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}


