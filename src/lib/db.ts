import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Database access for FinLeaf.
 *
 * One module-level pool. Queries go through `query`; anything that must be
 * atomic goes through `withTransaction`, which pins a single connection and
 * guarantees COMMIT/ROLLBACK.
 *
 * Money is BIGINT paise throughout, so every amount crosses the boundary as a
 * `bigint` and is converted to a number only at the display edge.
 */

declare global {
  // Next.js hot-reloads modules in dev; without this the pool is recreated on
  // every edit and Postgres starts refusing connections.
  var __finleafPool: Pool | undefined;
}

function connectionString() {
  const host = process.env.POSTGRES_HOST ?? "127.0.0.1";
  const port = Number(process.env.POSTGRES_PORT ?? 55432);
  const user = process.env.POSTGRES_USER ?? "finleaf";
  const password = process.env.POSTGRES_PASSWORD ?? "finleaf_local_dev";
  const database = process.env.POSTGRES_DB ?? "finleaf";
  return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function createPool(): Pool {
  return new Pool({
    connectionString: connectionString(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const pool = globalThis.__finleafPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__finleafPool = pool;
}

/** Run a single query. */
export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}

/** Run a query and return the first row, or null. */
export async function queryOne<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

/**
 * Run `fn` inside a transaction on a single checked-out client.
 *
 * Used for any multi-statement financial operation, e.g. debit one account,
 * credit another, write both transaction rows. A throw rolls the whole thing
 * back, so a partial transfer is not possible.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is already gone; releasing it below is all we can do.
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Liveness probe used by /api/health and the setup scripts. */
export async function ping(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}