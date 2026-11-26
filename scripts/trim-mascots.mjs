/**
 * Crops every mascot PNG in src/images/characters to its visible pixels (no transparent margin).
 * Run after adding or changing an image: npm run mascots:trim
 * Why: a transparent margin shifts the picture's visual centre, so it no longer lines up with the text next to it.
 * Uses `sharp`, which ships with Next.js. Originals in `_source/` are never touched.
 */
import { readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "images", "characters");
const ALPHA_THRESHOLD = 8; // ignore nearly invisible edge pixels

for (const file of readdirSync(DIR).filter((name) => name.endsWith(".png"))) {
  const path = join(DIR, file);
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) { console.log(`${file}: fully transparent, skipped`); continue; }

  const cropW = right - left + 1, cropH = bottom - top + 1;
  if (cropW === width && cropH === height) { console.log(`${file}: already tight (${width}x${height})`); continue; }

  const temp = `${path}.tmp`;
  await sharp(path)
    .extract({ left, top, width: cropW, height: cropH })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(temp);
  renameSync(temp, path);
  console.log(`${file}: ${width}x${height} -> ${cropW}x${cropH}`);
}
