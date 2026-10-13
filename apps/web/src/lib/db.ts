import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env, log } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * Prisma 7 requires an explicit driver adapter, so the Postgres connection is
 * supplied here rather than inferred. The instance is cached on `globalThis`:
 * `next dev` re-evaluates modules on every edit, and without the cache each
 * reload would open a fresh connection pool and exhaust the database's
 * connection limit.
 */

const globalForPrisma = globalThis as unknown as {
  __finleafPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env().DATABASE_URL,
    // Cap the pool so the app cannot starve other services sharing the database.
    max: 10,
  });

  return new PrismaClient({
    adapter,
    log:
      env().NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.__finleafPrisma ?? createClient();

if (env().NODE_ENV !== "production") {
  globalForPrisma.__finleafPrisma = prisma;
}

/**
 * Verifies the database is reachable. Used by the health endpoint so a
 * deployment can be probed for real readiness rather than just process liveness.
 */
export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    log("error", "database health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
