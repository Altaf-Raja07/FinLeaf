/**
 * Visual QA capture.
 *
 * Signs in, then screenshots a route at a fixed viewport and writes it into
 * artifacts/visual/ so it can be compared against the reference in design/.
 *
 * Viewports match the reference images:
 *   desktop  1586x992  (the generated references came out at this size)
 *   mobile    853x1844 (the generated mobile reference's size)
 *
 * A browser-scale viewport is also captured at 1440x900 for the conventional
 * "desktop" check.
 *
 * Usage:
 *   node scripts/visual-capture.mjs <route> [--viewport=desktop|mobile|wide]
 */
import { chromium } from "playwright";
import { signIn } from "./sign-in.mjs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = join(ROOT, "artifacts", "visual");

export const VIEWPORTS = {
  // Matches design/*.png desktop references exactly.
  desktop: { width: 1586, height: 992 },
  // Matches design/mobile-dashboard.png exactly.
  mobile: { width: 853, height: 1844 },
  // Conventional desktop check.
  wide: { width: 1440, height: 900 },
};

/**
 * Use the hostname the dev server reports for itself.
 *
 * Next.js derives the origin it redirects to from the incoming Host header, so a
 * redirect taken to 127.0.0.1 while the session cookie was set for localhost
 * looks like a signed-out user. Pinning one hostname everywhere keeps the cookie
 * origin and the redirect origin identical, which is also what a real user gets.
 */
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

async function main() {
  const route = process.argv[2] ?? "/dashboard";
  const viewportName =
    process.argv.find((a) => a.startsWith("--viewport="))?.split("=")[1] ?? "desktop";
  const viewport = VIEWPORTS[viewportName];
  if (!viewport) {
    console.error(`unknown viewport: ${viewportName}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    // A fixed locale and timezone keeps screenshots byte-comparable between runs.
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  // Public routes must be captured signed out: /login and /signup redirect an
  // authenticated visitor to the dashboard, so signing in first would silently
  // screenshot the wrong page.
  const captureSignedOut = process.argv.includes("--public");
  if (!captureSignedOut) {
    await signIn(page, BASE_URL);
  }

  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
  // Let fonts settle and any chart animation finish before capturing.
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(600);

  const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
  const file = join(OUT_DIR, `${slug}.${viewportName}.png`);
  await page.screenshot({ path: file, fullPage: false });

  const metrics = await page.evaluate(() => {
    const el = document.querySelector("main");
    const sidebar = document.querySelector("aside");
    const h1 = document.querySelector("h1");
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      mainLeft: el?.getBoundingClientRect().left ?? null,
      mainWidth: el?.getBoundingClientRect().width ?? null,
      sidebarWidth: sidebar?.getBoundingClientRect().width ?? null,
      heading: h1?.textContent?.trim() ?? null,
      scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  console.log(`captured ${route} @ ${viewportName} (${viewport.width}x${viewport.height})`);
  console.log(`  file: ${file.replace(ROOT + "/", "")}`);
  console.log(`  metrics: ${JSON.stringify(metrics)}`);
  if (consoleErrors.length > 0) {
    console.log(`  console errors (${consoleErrors.length}):`);
    for (const err of consoleErrors.slice(0, 5)) console.log(`    - ${err.slice(0, 160)}`);
  } else {
    console.log("  console errors: none");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});