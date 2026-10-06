import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/site";

/**
 * Sitemap.
 *
 * Only public routes belong here. Every other screen is behind a session, and
 * listing them would invite crawlers onto pages that redirect to sign-in.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/login", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/signup", priority: 0.9, changeFrequency: "monthly" as const },
  ];

  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${APP_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}