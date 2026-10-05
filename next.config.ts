import type { NextConfig } from "next";

/**
 * Next.js loads `.env` and `.env.local` automatically, so nothing is needed for
 * env loading here. The standalone `db/*.mjs` scripts load dotenv themselves.
 */
const nextConfig: NextConfig = {
  // pg ships a native addon, so it must not be bundled into the server build.
  serverExternalPackages: ["pg"],
};

export default nextConfig;