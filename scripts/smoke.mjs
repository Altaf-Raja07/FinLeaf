/**
 * Browser smoke test.
 *
 * Loads every route in a real browser and fails on anything a user would notice:
 * a console error, a page error, a failed request, or an unhandled rejection.
 * This is what caught the /voice hydration mismatch, which type checking and a
 * production build both passed.
 *
 * Usage: node scripts/smoke.mjs [--base=http://localhost:3100]
 */
import { chromium } from "playwright";

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  process.env.APP_URL ??
  "http://localhost:3100";

const DEMO_PHONE = process.env.DEMO_PHONE ?? "+91 98765 43210";
const DEMO_OTP = process.env.DEMO_OTP ?? "123456";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];
const PRIVATE_ROUTES = [
  "/dashboard",
  "/accounts",
  "/transactions",
  "/transfer",
  "/bills",
  "/trust-score",
  "/loans",
  "/goals",
  "/learn",
  "/family",
  "/circle",
  "/agents",
  "/sustainability",
  "/sustainability/how-calculated",
  "/sustainability/rewards",
  "/sustainability/compare",
  "/voice",
  "/chatbot",
  "/security/alerts",
  "/settings",
];

async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#phone", DEMO_PHONE);
  await page.click('button[type="submit"]');
  await page.waitForSelector("#otp", { state: "visible", timeout: 30000 });
  await page.fill("#otp", DEMO_OTP);
  await page.click('button[type="submit"]');
  await page.waitForSelector("main h1", { state: "visible", timeout: 30000 });
}

async function main() {
  const browser = await chromium.launch();
  const failures = [];
  let checked = 0;

  // Pass 1: public routes, signed out.
  {
    const context = await browser.newContext({ viewport: { width: 1586, height: 992 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

    for (const route of PUBLIC_ROUTES) {
      const problems = [];
      const onConsole = (msg) => {
        if (msg.type() === "error") problems.push(`console: ${msg.text().slice(0, 200)}`);
      };
      const onPageError = (err) => problems.push(`pageerror: ${String(err).slice(0, 200)}`);
      const onFailed = (req) => problems.push(`request failed: ${req.url()}`);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onFailed);

      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      checked += 1;

      if (problems.length > 0) failures.push({ route, problems: [...new Set(problems)] });
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onFailed);
      console.log(`${problems.length === 0 ? "ok  " : "FAIL"}  ${route}`);
    }
    await context.close();
  }

  // Pass 2: private routes, signed in.
  {
    const context = await browser.newContext({ viewport: { width: 1586, height: 992 } });
    const page = await context.newPage();
    await signIn(page);

    for (const route of PRIVATE_ROUTES) {
      const problems = [];
      const onConsole = (msg) => {
        if (msg.type() === "error") problems.push(`console: ${msg.text().slice(0, 200)}`);
      };
      const onPageError = (err) => problems.push(`pageerror: ${String(err).slice(0, 200)}`);
      const onFailed = (req) => problems.push(`request failed: ${req.url()}`);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onFailed);

      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      checked += 1;

      if (problems.length > 0) failures.push({ route, problems: [...new Set(problems)] });
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onFailed);
      console.log(`${problems.length === 0 ? "ok  " : "FAIL"}  ${route}`);
    }
    await context.close();
  }

  await browser.close();

  console.log(`\n${checked} routes checked, ${failures.length} with problems`);
  for (const f of failures) {
    console.log(`\n${f.route}`);
    for (const p of f.problems) console.log(`  ${p}`);
  }
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});