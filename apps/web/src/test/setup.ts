/**
 * Test environment setup.
 *
 * Supplied to every unit test through `vitest.config.ts` so that modules which
 * read `env()` at import time do not throw. Values are fixed and obviously fake:
 * no test may connect to a real database, and `server-only` is not engaged
 * because no test imports `next/headers`.
 *
 * `NODE_ENV` is set through `define` in the Vite config rather than here, since
 * Vitest's own typings make it read-only.
 */

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/finleaf_test?schema=public";
// A secret that is plainly a placeholder, so nothing here can be mistaken for a
// real credential or accidentally shipped.
process.env.APP_SECRET ??= "test-only-secret-at-least-32-characters-long";
process.env.APP_URL ??= "http://localhost:3000";
process.env.SMS_PROVIDER = "console";
process.env.ML_SERVICE_URL ??= "http://localhost:8000";
