import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the runtime image needs no
  // node_modules directory. Required by the `runner` stage of the Dockerfile.
  output: "standalone",

  cacheComponents: true,
  partialPrefetching: true,

  // React Compiler is deliberately off. It is off by default in Next 16 and
  // would add `babel-plugin-react-compiler` to the dependency tree for a
  // memoisation win this app does not need — the interactive surfaces here are
  // forms and charts, which re-render rarely.

  poweredByHeader: false,

  // `pg` and the Prisma engines must stay external to the server bundle: they
  // load native addons and read files from disk at runtime.
  serverExternalPackages: ["pg", "@prisma/client", "@prisma/adapter-pg"],

  // The curated reference data is read from disk at request time
  // (`readFile(process.cwd()/data/...)`), which output file tracing cannot see:
  // the path is built at runtime. Without this, the standalone build — and so
  // the production Docker image — would ship an app whose biller, agent and
  // offset pages fail with ENOENT on first request.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
  },

  // Typed routes are enabled for `next dev`/`next build` only once every route in
  // the nav exists; leaving them on while routes are still being built makes
  // `tsc --noEmit` fail on links to pages that do not exist yet, which masks
  // real type errors. Flip to true before shipping.
  typedRoutes: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Generated assets and uploads are never treated as documents.
        source: "/api/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      // The Prisma client is generated TypeScript checked into src/generated;
      // keep it out of the browser graph.
      "@/generated/prisma/*.ts": {
        loaders: [],
      },
    },
  },
};

export default nextConfig;
