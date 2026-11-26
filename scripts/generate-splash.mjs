/**
 * Makes the iOS launch screens (public/splash/*.png) listed in src/lib/splash-screens.json.
 * Run after changing the list, the background or the picture: npm run splash:generate
 * Why: iOS ignores the manifest's background_color and shows a blank white screen while a home-screen app starts,
 * unless it finds an `apple-touch-startup-image` whose size is EXACTLY the screen's (the layout adds the links).
 * The picture is Bubu dozing, the same one as the in-app loading screen, so the launch and the first loader look like one screen.
 * Uses `sharp`, which ships with Next.js.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "splash");
const { background, devices } = JSON.parse(readFileSync(join(ROOT, "src", "lib", "splash-screens.json"), "utf8"));
const BUBU = join(ROOT, "src", "images", "characters", "bubu-sleepy.png");

// Same as LoadingState: Bubu 112 CSS px wide, then a 12px gap and a one-line caption (22px) that the splash leaves out,
// all centred below the status bar. The caption's space is kept so the picture lands where the in-app Bubu will be.
const PICTURE_CSS_WIDTH = 112;
const CAPTION_SPACE_CSS = 12 + 22;
const STATUS_BAR_CSS = 50;

mkdirSync(OUT, { recursive: true });
const source = sharp(BUBU);
const { width: sourceWidth, height: sourceHeight } = await source.metadata();

for (const { width, height, ratio } of devices) {
  const pixelWidth = width * ratio;
  const pixelHeight = height * ratio;
  const pictureWidth = Math.round(PICTURE_CSS_WIDTH * ratio);
  const pictureHeight = Math.round((pictureWidth * sourceHeight) / sourceWidth);

  const groupHeight = pictureHeight + CAPTION_SPACE_CSS * ratio;
  const regionTop = STATUS_BAR_CSS * ratio;
  const top = Math.round(regionTop + (pixelHeight - regionTop - groupHeight) / 2);
  const left = Math.round((pixelWidth - pictureWidth) / 2);

  const picture = await sharp(BUBU).resize({ width: pictureWidth, height: pictureHeight, kernel: "lanczos3" }).toBuffer();
  const file = join(OUT, `splash-${pixelWidth}x${pixelHeight}.png`);
  await sharp({ create: { width: pixelWidth, height: pixelHeight, channels: 3, background } })
    .composite([{ input: picture, left, top }])
    .flatten({ background })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(file);
  console.log(`${pixelWidth}x${pixelHeight}  (${width}x${height} @${ratio}x)  picture at ${left},${top}`);
}
