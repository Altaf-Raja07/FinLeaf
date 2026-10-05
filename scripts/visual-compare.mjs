/**
 * Visual comparison between a reference image and a rendered screenshot.
 *
 * Produces three artefacts per route:
 *   - the rendered screenshot (from visual-capture.mjs)
 *   - a side-by-side strip
 *   - an absolute-difference image plus summary statistics
 *
 * And a machine-readable report to artifacts/visual/report.json.
 *
 * Important caveat, stated in the report too: these are two different renderers.
 * The reference came out of an image model, so exact pixels are not attainable and
 * a high score can coexist with a badly misplaced component. Treat the numbers as
 * a change-detector and a prompt to look, not as an acceptance criterion.
 *
 * Usage:
 *   node scripts/visual-compare.mjs --route=/dashboard --screenshot=dashboard.desktop.png \
 *                                    --reference=dashboard.png
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = join(ROOT, "artifacts", "visual");

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}

/**
 * Mean absolute error over RGB, 0-255.
 *
 * A deliberately simple metric. SSIM would be more perceptually faithful, but
 * these two images are structurally different renderings, so a perceptual score
 * would overstate agreement.
 */
async function meanAbsoluteError(aBuf, bBuf) {
  const { data: a } = await sharp(aBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: b } = await sharp(bBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const length = Math.min(a.length, b.length);
  let total = 0;
  for (let i = 0; i < length; i++) total += Math.abs(a[i] - b[i]);
  return total / length;
}

/** Fraction of pixels whose brightness differs by more than `tolerance` (0-255). */
async function mismatchRatio(aBuf, bBuf, tolerance = 32) {
  const { data: a } = await sharp(aBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: b } = await sharp(bBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const length = Math.min(a.length, b.length);
  let differing = 0;
  for (let i = 0; i < length; i += 3) {
    const delta =
      (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
    if (delta > tolerance) differing += 1;
  }
  return differing / (length / 3);
}

async function main() {
  const route = arg("route") ?? "/dashboard";
  const shotName = arg("screenshot") ?? `${route.replace(/^\//, "").replace(/\//g, "-")}.desktop.png`;
  const refName = arg("reference") ?? `${route.replace(/^\//, "").replace(/\//g, "-")}.png`;

  await mkdir(OUT_DIR, { recursive: true });

  const shotPath = join(OUT_DIR, shotName);
  const refPath = join(ROOT, "design", refName);

  let shotBuf, refBuf;
  try {
    shotBuf = await readFile(shotPath);
    refBuf = await readFile(refPath);
  } catch (err) {
    console.error(`could not read an input: ${err.message}`);
    process.exit(1);
  }

  const shotMeta = await sharp(shotBuf).metadata();
  const refMeta = await sharp(refBuf).metadata();

  const mae = await meanAbsoluteError(shotBuf, refBuf);
  const mismatch = await mismatchRatio(shotBuf, refBuf);

  // Normalise both to a common width so the diff and the side-by-side line up.
  // Aspect ratio is preserved, so a structural proportion mismatch stays visible
  // rather than being stretched away.
  const width = 1000;
  const targetHeight = (sourceWidth, sourceHeight) => Math.round((sourceHeight / sourceWidth) * width);

  const a = await sharp(refBuf).resize(width, targetHeight(refMeta.width, refMeta.height), { fit: "fill" }).png().toBuffer();
  const b = await sharp(shotBuf).resize(width, targetHeight(shotMeta.width, shotMeta.height), { fit: "fill" }).png().toBuffer();

  const diffPath = join(OUT_DIR, `${shotName.replace(/\.png$/, "")}.diff.png`);
  await sharp(a)
    .composite([{ input: b, blend: "difference" }])
    .linear(2.2)
    .png()
    .toFile(diffPath);

  const sidePath = join(OUT_DIR, `${shotName.replace(/\.png$/, "")}.side-by-side.png`);
  const gap = 16;
  await sharp({
    create: {
      width: width * 2 + gap,
      height: targetHeight(refMeta.width, refMeta.height),
      channels: 3,
      background: { r: 240, g: 240, b: 236 },
    },
  })
    .composite([{ input: a, left: 0, top: 0 }, { input: b, left: width + gap, top: 0 }])
    .png()
    .toFile(sidePath);

  const report = {
    route,
    reference: `design/${refName}`,
    screenshot: `artifacts/visual/${shotName}`,
    diff: `artifacts/visual/${diffPath.split("/").pop()}`,
    sideBySide: `artifacts/visual/${sidePath.split("/").pop()}`,
    referenceSize: `${refMeta.width}x${refMeta.height}`,
    screenshotSize: `${shotMeta.width}x${shotMeta.height}`,
    sizeMatches: refMeta.width === shotMeta.width && refMeta.height === shotMeta.height,
    meanAbsoluteError: Number(mae.toFixed(2)),
    pixelsDifferingOver32: Number((mismatch * 100).toFixed(1)),
    caveat:
      "Reference and render come from different engines (image model vs browser). " +
      "Numbers detect drift; they are not a pixel-identity acceptance test.",
    comparedAt: new Date().toISOString(),
  };

  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});