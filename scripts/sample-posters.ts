/**
 * Draws SAMPLE posters (2:3, 600x900: enough for a phone, and the character pictures are only about 180px wide, so a bigger poster would blur them) for the sample movies: a colour wash that suits the genre, one of the two characters
 * (Bubu or Dudu, from src/images/characters) and the title. They are placeholders to try the screens, not real posters.
 */
import { join } from "node:path";
import sharp from "sharp";

export interface PosterSpec {
  /** Title without the "(mẫu)" suffix. */
  title: string;
  /** Small line under the title, for example the genre. */
  tagline: string;
  /** Top and bottom of the background wash. */
  colors: [string, string];
  /** File in src/images/characters. */
  mascot: "bubu-going-out" | "bubu-happy" | "dudu-happy";
  /** Colour of the glow behind the character. */
  glow: string;
  /** Decoration: dots (stars, bokeh) drawn behind the character. */
  dots?: "stars" | "none";
}

const WIDTH = 600;
const HEIGHT = 900;

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Breaks a title into lines of at most `max` characters, on spaces. */
function wrap(title: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of title.split(/\s+/)) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Fixed pseudo-random dots so the same poster is drawn every time. */
function starDots(): string {
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 45 }, () => {
    const r = 1 + next() * 2.4;
    return `<circle cx="${Math.round(next() * WIDTH)}" cy="${Math.round(next() * 540)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.25 + next() * 0.6).toFixed(2)}"/>`;
  }).join("");
}

export async function makePoster(spec: PosterSpec): Promise<Buffer> {
  const lines = wrap(spec.title.toUpperCase(), 13);
  const titleSize = 62;
  const titleTop = 640;
  const titleSvg = lines
    .map((line, index) => `<text x="${WIDTH / 2}" y="${titleTop + index * (titleSize + 6)}" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${titleSize}" fill="#fff" letter-spacing="1">${escapeXml(line)}</text>`)
    .join("");
  const taglineY = titleTop + lines.length * (titleSize + 6) + 18;

  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${spec.colors[0]}"/><stop offset="1" stop-color="${spec.colors[1]}"/></linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${spec.glow}" stop-opacity="0.75"/><stop offset="1" stop-color="${spec.glow}" stop-opacity="0"/></radialGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash)"/>
    ${spec.dots === "stars" ? starDots() : ""}
    <ellipse cx="${WIDTH / 2}" cy="330" rx="340" ry="340" fill="url(#glow)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>
  </svg>`;

  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    ${titleSvg}
    <text x="${WIDTH / 2}" y="${taglineY}" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="500" font-size="26" fill="#fff" fill-opacity="0.85" letter-spacing="4">${escapeXml(spec.tagline.toUpperCase())}</text>
    <text x="${WIDTH / 2}" y="${HEIGHT - 40}" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="600" font-size="19" fill="#fff" fill-opacity="0.6" letter-spacing="5">PHIM MẪU</text>
  </svg>`;

  const mascot = await sharp(join(process.cwd(), "src/images/characters", `${spec.mascot}.png`)).resize({ width: 330, height: 380, fit: "inside", kernel: "lanczos3" }).toBuffer();
  const { width: mw = 330, height: mh = 380 } = await sharp(mascot).metadata();

  return sharp(Buffer.from(background))
    .composite([
      { input: mascot, left: Math.round((WIDTH - mw) / 2), top: Math.round(340 - mh / 2) },
      { input: Buffer.from(text), left: 0, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** The sample movies' posters, by title (without "(mẫu)"). */
export const SAMPLE_POSTERS: Record<string, PosterSpec> = {
  "Mùa Hè Của Chúng Ta": { title: "Mùa Hè Của Chúng Ta", tagline: "Tình cảm · Hài", colors: ["#ffb347", "#e8467c"], mascot: "dudu-happy", glow: "#fff3b0" },
  "Bóng Tối Dưới Nhà": { title: "Bóng Tối Dưới Nhà", tagline: "Kinh dị", colors: ["#0a0d18", "#33204a"], mascot: "bubu-going-out", glow: "#6c5ce7" },
  "Vũ Trụ Nhỏ": { title: "Vũ Trụ Nhỏ", tagline: "Hoạt hình", colors: ["#1a1464", "#7b2d9b"], mascot: "bubu-happy", glow: "#74b9ff", dots: "stars" },
  "Hành Trình Cuối Cùng": { title: "Hành Trình Cuối Cùng", tagline: "Hành động", colors: ["#f39c12", "#b8321f"], mascot: "dudu-happy", glow: "#ffe08a" },
};
