/// <reference types="vitest/config" />
import { pathToFileURL } from "node:url";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest configuration.
 *
 * The `@/*` alias mirrors tsconfig's `paths` so tests import modules the same
 * way the application does, rather than with relative paths that break the
 * moment a file moves.
 *
 * Tests are split by include: pure unit tests run everywhere; anything that
 * touches the database lives in `*.integration.test.ts` and is opted into by
 * `npm run test:integration`.
 */

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // `server-only` throws when imported outside a React server render, so the
    // ledger/audit modules it guards cannot be imported by a test. The test
    // process has no browser output, so the guard is stubbed. See
    // scripts/server-only-stub.ts for why this is safe.
    alias: { "server-only": pathToFileURL(require("node:path").join(process.cwd(), "scripts/server-only-stub.ts")).pathname },
  },
  // Replaced as a literal so `env()` sees a test build without assigning to the
  // read-only `process.env.NODE_ENV`.
  define: {
    "process.env.NODE_ENV": '"test"',
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.integration.test.ts", "node_modules", ".next", "src/generated"],
    setupFiles: ["src/test/setup.ts"],
    // The Prisma client is generated TypeScript; instrumenting it would slow
    // the run for no benefit.
    coverage: {
      provider: "v8",
      exclude: ["src/generated/**", "src/test/**", "**/*.test.ts"],
    },
  },
});
