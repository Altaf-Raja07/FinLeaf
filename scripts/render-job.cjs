#!/usr/bin/env node
/**
 * Renders scripts/generate-design.cjs with a concrete job substituted for the
 * __JOB__ marker, and validates a finished PNG into design/.
 *
 * Usage:
 *   node scripts/render-job.cjs start <filename> "<prompt>" [--timeout ms]
 *   node scripts/render-job.cjs finish <filename>
 *
 * `start` prints the path of the rendered script to hand to the Playwright MCP.
 * `finish` runs after the MCP call reports "stagedAt": it moves the PNG into
 * design/, verifies it is a real image, and records it in design/manifest.json.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const DESIGN_DIR = path.join(ROOT, "design");
const STAGING_DIR = "/tmp/opencode/design-staging";
const TEMPLATE = path.join(ROOT, "scripts", "generate-design.cjs");
const RENDERED = path.join(ROOT, ".design-job.rendered.cjs");
const MANIFEST = path.join(DESIGN_DIR, "manifest.json");

const [mode, ...rest] = process.argv.slice(2);

function readManifest() {
  if (!fs.existsSync(MANIFEST)) return { images: {} };
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return { images: {} };
  }
}

/** Returns {width,height} for a real PNG, or null if the header is wrong. */
function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

if (mode === "start") {
  const name = rest[0];
  const timeoutIdx = rest.indexOf("--timeout");
  const promptParts = timeoutIdx === -1 ? rest.slice(1) : rest.slice(1, timeoutIdx);
  const timeoutMs = timeoutIdx === -1 ? 300000 : Number(rest[timeoutIdx + 1]) || 300000;
  const prompt = promptParts.join(" ").trim();

  if (!name || !/^[a-z0-9][a-z0-9._-]*\.png$/.test(name)) {
    console.error("start: need a simple lowercase filename, e.g. dashboard.png");
    process.exit(1);
  }
  if (!prompt) {
    console.error("start: need a prompt");
    process.exit(1);
  }

  fs.mkdirSync(DESIGN_DIR, { recursive: true });
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  const tpl = fs.readFileSync(TEMPLATE, "utf8");
  // Replace only the assignment, never the mention inside the doc comment.
  const assignment = "const JOB = __JOB__;";
  if (!tpl.includes(assignment)) {
    console.error(`start: expected "${assignment}" in the template`);
    process.exit(1);
  }
  // Strip comments and blank lines from the rendered script: the MCP echoes the
  // whole file back on every call, and this runs ~25 times.
  const compact = tpl
    .replace(assignment, `const JOB = ${JSON.stringify({ filename: name, prompt, timeoutMs })};`)
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .map((line) => line.replace(/^\s+/, (m) => " ".repeat(Math.min(m.length, 2))))
    .join("\n");

  fs.writeFileSync(RENDERED, compact);
  console.log(RENDERED);
  process.exit(0);
}

if (mode === "finish") {
  const name = rest[0];
  if (!name) {
    console.error("finish: need the filename");
    process.exit(1);
  }
  const staged = path.join(STAGING_DIR, name);

  if (!fs.existsSync(staged)) {
    console.error(`finish: staged file missing at ${staged}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(staged);
  const size = pngSize(buf);
  if (!size) {
    console.error(`finish: ${name} is not a valid PNG`);
    process.exit(1);
  }
  if (size.width < 200 || size.height < 200) {
    console.error(`finish: ${name} has implausible dimensions ${size.width}x${size.height}`);
    process.exit(1);
  }
  // A truncated download still has a valid header, so require the trailer too.
  if (!buf.subarray(-8).toString("latin1").includes("IEND")) {
    console.error(`finish: ${name} looks truncated (no IEND chunk)`);
    process.exit(1);
  }

  fs.copyFileSync(staged, path.join(DESIGN_DIR, name));
  fs.unlinkSync(staged);

  const manifest = readManifest();
  manifest.images[name] = {
    width: size.width,
    height: size.height,
    bytes: buf.length,
    savedAt: new Date().toISOString(),
    source: "ChatGPT image generation via authenticated browser session",
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  console.log(
    `[finish] design/${name}  ${size.width}x${size.height} (aspect ${(size.width / size.height).toFixed(3)})  ` +
      `${(buf.length / 1024).toFixed(0)}KB  | manifest entries: ${Object.keys(manifest.images).length}`
  );
  process.exit(0);
}

console.error("usage: render-job.cjs start <filename> \"<prompt>\" | finish <filename>");
process.exit(1);