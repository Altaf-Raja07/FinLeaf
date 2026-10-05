import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg ships a native addon, so it must not be bundled into the server build.
  serverExternalPackages: ["pg"],

  /**
   * Next blocks cross-origin requests to /_next dev resources by default. The
   * visual-QA harness drives the app over 127.0.0.1 while the dev server reports
   * itself as localhost, so both names have to be allowed in development.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;