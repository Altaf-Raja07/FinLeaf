#!/usr/bin/env node
/**
 * Optimise the generated assets for the clients this product actually targets.
 *
 * ChatGPT emits 1536x1024 PNGs totalling ~15 MB. Shipping those to a budget
 * phone on a slow connection is not viable, and design-system.md requires the app
 * to stay usable on modest devices. So each asset is:
 *
 *   - resized to a width that matches where it is displayed, so a 320px empty
 *     state is not served a 1536px image
 *   - converted to WebP, which is dramatically smaller than PNG for this kind of
 *     flat illustration
 *
 * The PNGs are kept alongside as the source of truth, so an asset can be
 * re-derived at a different size without regenerating it.
 *
 * Usage: node scripts/optimise-assets.mjs
 */
import { readdir, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ASSET_DIR = join(ROOT, "public", "assets");

/** Displayed width per asset, in CSS pixels, plus a 2x allowance for retina. */
const TARGET_WIDTH = {
  "hero-illustration": 640,
  "agent-kiosk": 560,
  "auth-welcome": 300,
  "empty-transactions": 220,
  "empty-goals": 220,
  "empty-rewards": 220,
  "voice-assistant": 200,
  "lesson-savings-safe": 320,
  "lesson-on-time-bills": 320,
  "lesson-trust-score": 320,
};

const QUALITY = 78;

async function main() {
  await mkdir(ASSET_DIR, { recursive: true });
  const files = (await readdir(ASSET_DIR)).filter((f) => f.endsWith(".png"));
  if (files.length === 0) {
    console.log("no PNG assets to optimise");
    return;
  }

  let before = 0;
  let after = 0;

  console.log("asset                       source      ->  webp       ratio");
  for (const file of files) {
    const key = file.replace(/\.png$/, "");
    const src = join(ASSET_DIR, file);
    const dest = join(ASSET_DIR, `${key}.webp`);

    const srcStat = await stat(src);
    before += srcStat.size;

    const width = (TARGET_WIDTH[key] ?? 400) * 2;
    const buffer = await sharp(src)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toBuffer();

    await writeFile(dest, buffer);
    after += buffer.byteLength;

    const saved = (srcStat.size / buffer.byteLength).toFixed(1);
    console.log(
      `${key.padEnd(26)} ${(srcStat.size / 1024).toFixed(0).padStart(5)} KB   ->  ${(buffer.length / 1024)
        .toFixed(0)
        .padStart(5)} KB   ${saved}x`
    );
  }

  const meta = files.map((f) => {
    const key = f.replace(/\.png$/, "");
    return { key, webp: `assets/${key}.webp`, source: `assets/${f}` };
  });
  await writeFile(join(ASSET_DIR, "index.json"), JSON.stringify({ quality: QUALITY, assets: meta }, null, 2));

  console.log(
    `\ntotal ${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024).toFixed(0)} KB  ` +
      `(${((1 - after / before) * 100).toFixed(1)}% smaller)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});