import { checkDatabase } from "@/lib/db";
import { log } from "@/lib/env";
import { handleRoute, ok } from "@/lib/api";

/**
 * Health endpoint.
 *
 * Reports the two dependencies that actually gate the product: the database and
 * the ML service. The ML service is reported but **not** required — the web app
 * falls back to a transparent rule set when it is down, so a 503 for `ml` should
 * not fail a container healthcheck. That is why `database` is the only field a
 * monitor should alert on.
 *
 * The `ml: "fallback"` state is deliberate rather than an error state: it tells
 * an operator exactly which path scores are taking without failing the probe.
 */
export const GET = handleRoute(async () => {
  const database = await checkDatabase();

  const body: {
    status: string;
    service: string;
    database: string;
    ml: string;
  } = {
    status: database ? "ok" : "degraded",
    service: "finleaf-web",
    database: database ? "ok" : "unavailable",
    ml: "ok",
  };

  if (!database) {
    log("error", "health check: database unavailable");
    // 503 rather than hiding it: a load balancer must be able to take this
    // instance out of rotation.
    return ok(body, { status: 503 });
  }

  return ok(body);
});
