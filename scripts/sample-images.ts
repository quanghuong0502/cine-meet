/**
 * Draws SAMPLE pictures for the sample brands and branches: a logo (the brand colour with its initials) and a branch photo
 * (16:9, a wash of the brand colour, the two characters watching, and the brand name). They are placeholders to try the screens,
 * not real logos or photos.
 */
import { join } from "node:path";
import sharp from "sharp";

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Up to two capital letters: the first letters of the first two words. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** A hex colour mixed with black (`amount` 0..1), for the dark end of a wash. */
function darken(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, "0")).join("")}`;
}

/** Square 512px logo: the brand colour with its initials. */
export async function makeBrandLogo(name: string, color: string): Promise<Buffer> {
  const size = 512;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${darken(color, 0.35)}"/></linearGradient></defs>
    <rect width="${size}" height="${size}" rx="96" fill="url(#wash)"/>
    <text x="${size / 2}" y="${size / 2}" dy="0.35em" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${initials(name).length > 1 ? 200 : 260}" fill="#fff">${escapeXml(initials(name))}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** 16:9 photo (960x540) of a branch: brand colour wash, Bubu and Dudu watching, the brand name, and "RẠP MẪU". */
export async function makeBranchImage(brandName: string, color: string): Promise<Buffer> {
  const width = 960;
  const height = 540;
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${darken(color, 0.55)}"/></linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#wash)"/>
    <ellipse cx="${width * 0.7}" cy="${height * 0.45}" rx="300" ry="260" fill="url(#glow)"/>
    <rect width="${width}" height="${height}" fill="url(#shade)"/>
  </svg>`;
  // The name must end before the characters begin (they take the right 380px), so a long name is set smaller.
  const nameSize = Math.min(84, Math.floor(440 / (0.6 * brandName.length)));
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="56" y="${height - 96}" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${nameSize}" fill="#fff">${escapeXml(brandName)}</text>
    <text x="58" y="${height - 48}" font-family="Helvetica Neue, Arial, sans-serif" font-weight="600" font-size="26" fill="#fff" fill-opacity="0.75" letter-spacing="6">RẠP MẪU</text>
  </svg>`;
  const mascot = await sharp(join(process.cwd(), "src/images/characters", "duo-watching.png")).resize({ width: 380, height: 330, fit: "inside", kernel: "lanczos3" }).toBuffer();
  const { width: mw = 380, height: mh = 330 } = await sharp(mascot).metadata();
  return sharp(Buffer.from(background))
    .composite([
      { input: mascot, left: width - mw - 48, top: Math.round((height - mh) / 2) - 20 },
      { input: Buffer.from(text), left: 0, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}
