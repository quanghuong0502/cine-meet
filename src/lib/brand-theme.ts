/**
 * The brand colour: from one hex colour the admin picks to the few numbers the stylesheet is built on (`--brand-h/c/l` and two
 * text colours in globals.css). Everything else (surfaces, borders, muted text, accents, seats) follows from the hue, so it is
 * not stored. Pure and tested; no database. The default is raspberry #C61583.
 */

export const DEFAULT_BRAND_HEX = "#C61583";

export type BrandThemeError = "invalid_color" | "too_gray" | "too_dark";

export interface BrandTheme {
  /** OKLCH hue (degrees), chroma and lightness of the main button. */
  h: number;
  c: number;
  l: number;
  /** CSS colour of the text on the main button: near-white or near-black, whichever reads better. */
  fg: string;
  /** CSS colour for brand-coloured text on the LIGHT theme (the brand colour itself, darkened until it reads at 4.5:1). */
  ink: string;
  /** The dark theme's page background as hex: the status-bar colour (`theme-color`) and the PWA manifest colours. */
  themeColorHex: string;
}

type Rgb = [number, number, number];

/** Surfaces the contrast is measured against (the same numbers as the dark and light blocks of globals.css). */
const DARK_BACKGROUND = { l: 0.155, c: 0.022 };
const DARK_CARD = { l: 0.205, c: 0.028 };
const LIGHT_BACKGROUND = { l: 0.99, c: 0.006 };

/** WCAG: the main button must stand out from the dark card (non-text contrast), and brand text must read at 4.5:1. */
const MIN_BUTTON_VS_CARD = 3;
const MIN_TEXT = 4.5;
/** Below this chroma a colour is grey: it has no hue to build the surfaces on. */
const MIN_CHROMA = 0.03;
const MAX_CHROMA = 0.3;

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const v = Math.min(1, Math.max(0, value));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

export function parseHex(hex: string): Rgb | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match?.[1]) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** sRGB (0 to 255) to OKLCH (Ottosson's OKLab). */
export function rgbToOklch([r, g, b]: Rgb): { l: number; c: number; h: number } {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return { l: L, c: Math.hypot(a, bb), h: h < 0 ? h + 360 : h };
}

/** OKLCH to sRGB (0 to 255), clipped into the screen's range. */
export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lr = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const lg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const lb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return [linearToSrgb(lr) * 255, linearToSrgb(lg) * 255, linearToSrgb(lb) * 255];
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255);
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** From the colour the admin picked to the brand theme, or the reason it cannot be used. */
export function deriveBrandTheme(hex: string): { ok: true; theme: BrandTheme } | { ok: false; error: BrandThemeError } {
  const rgb = parseHex(hex);
  if (!rgb) return { ok: false, error: "invalid_color" };

  const picked = rgbToOklch(rgb);
  if (picked.c < MIN_CHROMA) return { ok: false, error: "too_gray" };
  const h = round(picked.h, 1);
  const c = round(Math.min(picked.c, MAX_CHROMA), 3);
  const l = round(picked.l, 3);

  const button = oklchToRgb(l, c, h);
  if (contrastRatio(button, oklchToRgb(DARK_CARD.l, DARK_CARD.c, h)) < MIN_BUTTON_VS_CARD) return { ok: false, error: "too_dark" };

  // Text on the button: near-white or near-black, whichever contrasts more (one of them always reaches 4.5:1).
  const white = oklchToRgb(0.99, 0.005, h);
  const black = oklchToRgb(0.15, 0.02, h);
  const fg = contrastRatio(button, white) >= contrastRatio(button, black) ? "oklch(0.99 0.005 " + h + ")" : "oklch(0.15 0.02 " + h + ")";

  // Brand-coloured text on the light theme: darken until it reads at 4.5:1 on the light background.
  const lightBackground = oklchToRgb(LIGHT_BACKGROUND.l, LIGHT_BACKGROUND.c, h);
  let inkL = l;
  while (inkL > 0.2 && contrastRatio(oklchToRgb(inkL, c, h), lightBackground) < MIN_TEXT) inkL = round(inkL - 0.01, 2);

  return {
    ok: true,
    theme: {
      h,
      c,
      l,
      fg,
      ink: `oklch(${inkL} ${c} ${h})`,
      themeColorHex: toHex(oklchToRgb(DARK_BACKGROUND.l, DARK_BACKGROUND.c, h)),
    },
  };
}

/** The default brand theme (never fails: the default colour is valid). */
export function defaultBrandTheme(): BrandTheme {
  const result = deriveBrandTheme(DEFAULT_BRAND_HEX);
  if (!result.ok) throw new Error("The default brand colour must be valid");
  return result.theme;
}

/** The stylesheet that sets the brand variables for the whole app (put in the page head, so the colour is right from the first paint). */
export function brandThemeCss(theme: BrandTheme): string {
  return `:root{--brand-h:${theme.h};--brand-c:${theme.c};--brand-l:${theme.l};--brand-fg:${theme.fg};--brand-ink:${theme.ink}}`;
}

/** Dark-theme text colour used for brand-coloured text (globals.css `--primary-text` in `.dark`), for the contrast tests. */
export const DARK_PRIMARY_TEXT = { l: 0.78, c: 0.14 };
export const SURFACES = { DARK_BACKGROUND, DARK_CARD, LIGHT_BACKGROUND };
