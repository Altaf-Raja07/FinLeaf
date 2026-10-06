/**
 * Batch visual QA: capture every implemented route at the reference viewport and
 * compare against its approved reference, writing one consolidated report.
 *
 * Usage:
 *   node scripts/visual-qa.mjs               all routes
 *   node scripts/visual-qa.mjs /goals /loans  a subset
 *   node scripts/visual-qa.mjs --mobile      mobile viewport instead of desktop
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = join(ROOT, "artifacts", "visual");

/** route -> reference image name in design/ */
export const ROUTE_REFERENCES = {
  "/": "landing",
  "/login": "login",
  "/signup": "signup",
  "/dashboard": "dashboard",
  "/accounts": "accounts",
  "/transactions": "transaction-history",
  "/transfer": "transfer",
  "/bills": "bill-payments",
  "/trust-score": "trust-score",
  "/loans": "loan-application",
  "/goals": "savings-goals",
  "/learn": "financial-literacy",
  "/family": "family-accounts",
  "/circle": "trust-circles",
  "/agents": "agent-locator",
  "/sustainability": "sustainability-dashboard",
  "/sustainability/how-calculated": "carbon-details",
  "/sustainability/rewards": "green-rewards",
  "/sustainability/compare": "leaderboard",
  "/security/alerts": "fraud-alerts",
  "/settings": "profile-settings",
  "/sustainability/offsets": "carbon-offsets",
  "/voice": "voice-assistant",
  "/chatbot": "chatbot",
};

async function main() {
  const viewport = process.argv.includes("--mobile") ? "mobile" : "desktop";
  const explicit = process.argv.slice(2).filter((a) => a.startsWith("/"));
  const routes = explicit.length > 0 ? explicit : Object.keys(ROUTE_REFERENCES);

  const results = [];

  for (const route of routes) {
    const reference = ROUTE_REFERENCES[route];
    if (!reference) {
      results.push({ route, status: "no-reference-mapping" });
      continue;
    }

    const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
    const shotName = `${slug}.${viewport}.png`;

    const isPublic = ["/", "/login", "/signup"].includes(route);
    try {
      execFileSync(
        "node",
        [
          join(ROOT, "scripts", "visual-capture.mjs"),
          route,
          `--viewport=${viewport}`,
          // /login and /signup redirect an authenticated visitor to the
          // dashboard, so capturing them signed in would screenshot the wrong page.
          ...(isPublic ? ["--public"] : []),
        ],
        { stdio: "pipe" }
      );
    } catch (err) {
      results.push({ route, reference, status: "capture-failed", detail: String(err.stderr ?? err).slice(0, 200) });
      continue;
    }

    try {
      execFileSync(
        "node",
        [
          join(ROOT, "scripts", "visual-compare.mjs"),
          `--route=${route}`,
          `--screenshot=${shotName}`,
          `--reference=${reference}.png`,
        ],
        { stdio: "pipe" }
      );
      const report = JSON.parse(await readFile(join(OUT_DIR, "report.json"), "utf8"));
      results.push({
        route,
        reference: `design/${reference}.png`,
        screenshot: `artifacts/visual/${shotName}`,
        sizeMatches: report.sizeMatches,
        meanAbsoluteError: report.meanAbsoluteError,
        pixelsDifferingOver32: report.pixelsDifferingOver32,
        status: "compared",
      });
      console.log(
        `${route.padEnd(34)} MAE ${String(report.meanAbsoluteError).padStart(6)}  ${String(
          report.pixelsDifferingOver32
        ).padStart(5)}% differ`
      );
    } catch (err) {
      results.push({ route, reference, status: "compare-failed", detail: String(err.stderr ?? err).slice(0, 200) });
      console.log(`${route.padEnd(34)} compare failed`);
    }
  }

  const existing = await readdir(OUT_DIR).catch(() => []);
  await writeFile(
    join(OUT_DIR, `qa-${viewport}.json`),
    JSON.stringify(
      {
        viewport,
        comparedAt: new Date().toISOString(),
        note:
          "Reference and render come from different engines (image model vs browser), so these " +
          "numbers detect drift; they are not a pixel-identity acceptance test. Dynamic values " +
          "(balances, scores, emissions) legitimately differ from the reference figures.",
        routes: results,
        screenshotsPresent: existing.filter((f) => f.endsWith(".png")).length,
      },
      null,
      2
    )
  );

  const compared = results.filter((r) => r.status === "compared");
  console.log(`\n${compared.length}/${results.length} routes compared at ${viewport}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});