/**
 * Render an asset-generation job for the Playwright sandbox.
 *
 * Wraps the reference-generation script (which already handles driving ChatGPT
 * and pulling the finished file out via a download event) but points it at the
 * asset staging area and the asset prompt library.
 *
 * Usage:
 *   node scripts/render-asset.cjs hero-illustration
 *   node scripts/render-asset.cjs --list
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS } from "./asset-prompts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const TEMPLATE = join(ROOT, "scripts", "generate-design.cjs");
const RENDERED = join(ROOT, ".asset-job.rendered.cjs");

const STAGING = "/tmp/opencode/asset-staging";

if (process.argv[2] === "--list") {
  for (const key of Object.keys(ASSETS)) console.log(key);
  process.exit(0);
}

const key = process.argv[2];
if (!key || !ASSETS[key]) {
  console.error(`usage: render-asset.cjs <${Object.keys(ASSETS).join("|")}>`);
  process.exit(1);
}

mkdirSync(STAGING, { recursive: true });

const tpl = readFileSync(TEMPLATE, "utf8");
const assignment = "const JOB = __JOB__;";
if (!tpl.includes(assignment)) {
  console.error("generate-design.cjs no longer has the expected JOB assignment");
  process.exit(1);
}

// Point the script at the asset staging directory instead of design/ staging.
let rendered = tpl.replace(
  assignment,
  `const JOB = ${JSON.stringify({
    filename: `${key}.png`,
    prompt: ASSETS[key].prompt,
    timeoutMs: 300000,
  })};`
);
rendered = rendered.replace(
  'const tmp = "/tmp/opencode/design-staging/" + JOB.filename;',
  `const tmp = "${STAGING}/" + JOB.filename;`
);

// Same comment-stripping as the reference path, so the echoed code stays small.
rendered = rendered
  .split("\n")
  .filter((line) => {
    const t = line.trim();
    return t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .map((line) => line.replace(/^\s+/, (m) => " ".repeat(Math.min(m.length, 2))))
  .join("\n");

writeFileSync(RENDERED, rendered);
console.log(RENDERED);