#!/usr/bin/env node
/**
 * Decodes a base64 PNG payload (stdin) into design/<filename>.
 *
 * Kept as a fallback path: the primary route uses scripts/render-job.cjs plus a
 * browser download event. Use this only when a base64 payload is what you have.
 *
 * Usage: node scripts/save-design.cjs <filename>   (JSON payload on stdin)
 */
const fs = require("node:fs");
const path = require("node:path");

const expected = process.argv[2];
if (!expected) {
  console.error("usage: save-design.cjs <filename>   (payload on stdin)");
  process.exit(1);
}

const DESIGN_DIR = path.resolve(process.cwd(), "design");
const MANIFEST = path.join(DESIGN_DIR, "manifest.json");
fs.mkdirSync(DESIGN_DIR, { recursive: true });

let raw = fs.readFileSync(0, "utf8").trim();
// The MCP result may arrive already JSON-encoded as a string; unwrap either way.
try {
  raw = JSON.parse(raw);
} catch {
  /* plain text */
}
if (typeof raw === "string") {
  try {
    raw = JSON.parse(raw);
  } catch {
    console.error("could not parse the payload as JSON");
    process.exit(1);
  }
}

if (!raw || raw.status !== "ok") {
  console.error(`generation failed: ${JSON.stringify(raw).slice(0, 300)}`);
  process.exit(1);
}
if (expected && raw.filename && raw.filename !== expected) {
  console.error(`filename mismatch: wanted ${expected}, got ${raw.filename}`);
  process.exit(1);
}

const name = expected || raw.filename;
const buf = Buffer.from(raw.data, "base64");

if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
  console.error(`not a PNG (magic ${buf.subarray(0, 4).toString("hex")})`);
  process.exit(1);
}
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
if (width < 200 || height < 200) {
  console.error(`implausible dimensions ${width}x${height}`);
  process.exit(1);
}
if (!buf.subarray(-8).toString("latin1").includes("IEND")) {
  console.error("file looks truncated (no IEND chunk)");
  process.exit(1);
}

fs.writeFileSync(path.join(DESIGN_DIR, name), buf);

let manifest = { images: {} };
if (fs.existsSync(MANIFEST)) {
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    /* keep default */
  }
}
manifest.images[name] = {
  width,
  height,
  bytes: buf.length,
  savedAt: new Date().toISOString(),
  source: "ChatGPT image generation via authenticated browser session",
};
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log(`[save-design] design/${name}  ${width}x${height}  ${(buf.length / 1024).toFixed(0)}KB`);