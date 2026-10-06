import type { MetadataRoute } from "next";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/site";

/**
 * Web app manifest, so FinLeaf can be installed to a home screen and launches
 * without browser chrome. start_url is the dashboard because that is where a
 * signed-in user always wants to land.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — banking that works for everyone`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1f6f4a",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}