import { NextResponse } from "next/server";
import { ping, queryOne } from "@/lib/db";
import { mlHealth } from "@/lib/ml-client";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness probe.
 *
 * Returns 200 only when the database answers, because an instance that cannot
 * reach the database cannot serve a single page. The ML service is reported but
 * does not affect the status: the app has a built-in fallback scorer and stays
 * usable without it, so failing the probe on it would take down a healthy
 * instance during an unrelated outage.
 *
 * Deliberately unauthenticated so a load balancer or orchestrator can call it, so
 * it exposes liveness only: no versions, no hostnames, no configuration.
 */
export async function GET() {
  const databaseUp = await ping();
  const migrations = databaseUp ? await checkMigrations() : { upToDate: false, latest: null };
  const mlUp = await mlHealth();

  const ready = databaseUp && migrations.upToDate;

  return NextResponse.json(
    {
      status: ready ? "ok" : "unavailable",
      database: databaseUp ? "up" : "down",
      migrations,
      // Informational only. The app falls back to local scoring, so this never
      // affects the readiness verdict above.
      mlService: mlUp.reachable ? "up" : "down (using built-in scoring)",
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

/** Compare the highest applied migration against the files on disk. */
async function checkMigrations(): Promise<{ upToDate: boolean; latest: string | null }> {
  try {
    const applied = await queryOne<{ latest: string | null }>(
      `SELECT MAX(filename) AS latest FROM schema_migrations`
    );
    const { readdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const files = await readdir(join(process.cwd(), "db", "migrations"));
    const newestOnDisk = files.filter((f) => f.endsWith(".sql")).sort().at(-1) ?? null;

    return {
      upToDate: applied?.latest === newestOnDisk,
      latest: applied?.latest ?? null,
    };
  } catch {
    return { upToDate: false, latest: null };
  }
}