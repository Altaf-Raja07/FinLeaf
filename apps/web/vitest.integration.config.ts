/// <reference types="vitest/config" />
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Integration-test config: the same as the unit config, but it includes the
 * database-backed suites.
 *
 * Run with `npm run test:integration`. These need a live Postgres at
 * DATABASE_URL and are excluded from `npm test` so a contributor without a
 * database running still gets a green unit run.
 */
// Load apps/web/.env before the test process starts, so the integration tests
// see the same DATABASE_URL the application uses. Done here rather than in the
// setup file because setup runs after the Prisma client module is imported.
import { loadEnv } from "vite";
const env = loadEnv("test", process.cwd(), "");

Object.assign(process.env, {
  TEST_DATABASE_URL: env.DATABASE_URL,
  DATABASE_URL: env.DATABASE_URL,
});

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // `server-only` throws when imported outside a React server render, so the
    // ledger/audit modules it guards cannot be imported by a test. The test
    // process has no browser output, so the guard is stubbed. See
    // scripts/server-only-stub.ts for why this is safe.
    alias: { "server-only": pathToFileURL(join(process.cwd(), "scripts/server-only-stub.ts")).pathname },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
