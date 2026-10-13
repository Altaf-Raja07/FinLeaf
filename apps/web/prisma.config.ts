import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * DATABASE_URL is read from the environment rather than hard-coded so the same
 * config works against local docker-compose Postgres and any managed host.
 * `apps/web/.env` is loaded by the `dotenv/config` import above.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
