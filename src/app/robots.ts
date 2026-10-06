import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        // Everything else is either behind a session or an API. Crawling them
        // produces nothing useful and generates pointless auth redirects.
        disallow: ["/api/", "/dashboard", "/accounts", "/transactions", "/transfer", "/bills",
          "/goals", "/loans", "/trust-score", "/sustainability", "/learn", "/family", "/circle",
          "/agents", "/voice", "/chatbot", "/settings", "/security"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}