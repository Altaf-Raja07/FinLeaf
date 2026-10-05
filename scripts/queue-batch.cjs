#!/usr/bin/env node
/**
 * Renders the next N design jobs from scripts/prompts.mjs so they can be pushed
 * through the Playwright MCP one at a time.
 *
 * Usage:
 *   node scripts/queue-batch.cjs <name> [<name> ...]
 *   node scripts/queue-batch.cjs --next           # print the next ungenerated job
 *   node scripts/queue-batch.cjs --remaining     # list everything still missing
 *
 * `queue-batch` writes .design-queue.json; the agent then renders each entry and
 * calls the MCP, so a batch can be generated without re-specifying prompts.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const DESIGN_DIR = path.join(ROOT, "design");
const QUEUE_FILE = path.join(ROOT, ".design-queue.json");
const MANIFEST = path.join(DESIGN_DIR, "manifest.json");

function existing() {
  if (!fs.existsSync(MANIFEST)) return new Set();
  try {
    return new Set(Object.keys(JSON.parse(fs.readFileSync(MANIFEST, "utf8")).images || {}));
  } catch {
    return new Set();
  }
}

async function loadPrompts() {
  const mod = await import(path.join(ROOT, "scripts", "prompts.mjs"));
  return { ...mod.PAGES, ...mod.MOBILE };
}

async function main() {
  const ALL = await loadPrompts();
  const args = process.argv.slice(2);

  if (args[0] === "--next") {
    const have = existing();
    const next = Object.keys(ALL).find((k) => !have.has(`${k}.png`));
    if (!next) {
      console.log(JSON.stringify({ done: true }));
    } else {
      console.log(
        JSON.stringify({
          name: `${next}.png`,
          key: next,
          remaining: Object.keys(ALL).filter((k) => !have.has(`${k}.png`)).length,
        })
      );
    }
    process.exit(0);
  }

  if (args[0] === "--remaining") {
    const have = existing();
    const remaining = Object.keys(ALL).filter((k) => !have.has(`${k}.png`));
    console.log(`${remaining.length} of ${Object.keys(ALL).length} remaining:`);
    for (const k of remaining) console.log(`  ${k}.png`);
    process.exit(0);
  }

  const names = args.filter((a) => !a.startsWith("--"));
  if (!names.length) {
    console.error("usage: queue-batch.cjs <name> [...] | --next | --remaining");
    process.exit(1);
  }

  const unknown = names.filter((n) => !ALL[n]);
  if (unknown.length) {
    console.error(`unknown prompt keys: ${unknown.join(", ")}`);
    console.error(`available: ${Object.keys(ALL).join(" ")}`);
    process.exit(1);
  }

  const jobs = names.map((n) => ({ name: `${n}.png`, prompt: ALL[n] }));
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(jobs, null, 2));
  console.log(JSON.stringify({ queued: jobs.map((j) => j.name) }));
}

main();
