#!/usr/bin/env node
/**
 * Minimal forward-only migration runner.
 *
 * Applies every db/migrations/*.sql file that has not run yet, in filename
 * order, each inside its own transaction, and records it in schema_migrations.
 * Deliberately no rollback and no ORM: the schema is small, and owning the SQL
 * outright keeps the financial constraints readable and auditable.
 *
 * Usage:
 *   node db/migrate.mjs            apply pending migrations
 *   node db/migrate.mjs --status   show applied/pending without changing anything
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

// Load .env so the CLI scripts and the Next server agree on the same values.
dotenv.config({ quiet: true });

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "migrations");

export function connectionConfig() {
  return {
    host: process.env.POSTGRES_HOST ?? "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT ?? 55432),
    user: process.env.POSTGRES_USER ?? "finleaf",
    password: process.env.POSTGRES_PASSWORD ?? "finleaf_local_dev",
    database: process.env.POSTGRES_DB ?? "finleaf",
  };
}

async function main() {
  const statusOnly = process.argv.includes("--status");
  const client = new pg.Client(connectionConfig());
  await client.connect();

  try {
    // The bookkeeping table itself is created outside the migration set so the
    // runner can always know what has been applied.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (statusOnly) {
      console.log(`database: ${connectionConfig().database}@${connectionConfig().host}:${connectionConfig().port}`);
      for (const f of files) {
        console.log(`  ${applied.has(f) ? "applied" : "pending"}  ${f}`);
      }
      return;
    }

    if (pending.length === 0) {
      console.log(`[migrate] nothing to do (${files.length} migrations already applied)`);
      return;
    }

    for (const file of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      // Each migration is atomic: a failure leaves no half-applied schema.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate] FAILED ${file}: ${err.message}`);
        throw err;
      }
    }
    console.log(`[migrate] done: ${pending.length} applied, ${files.length} total`);
  } finally {
    await client.end();
  }
}

// Only run when invoked directly, so the config can be imported by other scripts.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}