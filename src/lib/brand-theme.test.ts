import { describe, expect, it } from "vitest";
import {
  brandThemeCss,
  contrastRatio,
  DARK_PRIMARY_TEXT,
  defaultBrandTheme,
  deriveBrandTheme,
  oklchToRgb,
  parseHex,
  rgbToOklch,
  SURFACES,
  toHex,
} from "./brand-theme";

describe("colour conversion", () => {
  it("round-trips a hex colour through OKLCH", () => {
    for (const hex of ["#C61583", "#0A84FF", "#FFD60A", "#30D158", "#FFFFFF", "#000000"]) {
      const rgb = parseHex(hex);
      if (!rgb) throw new Error(hex);
      const { l, c, h } = rgbToOklch(rgb);
      expect(toHex(oklchToRgb(l, c, h))).toBe(hex);
    }
  });

  it("rejects what is not a six-digit hex colour", () => {
    expect(parseHex("C61583")).toBeNull();
    expect(parseHex("#C6158")).toBeNull();
    expect(parseHex("red")).toBeNull();
  });
});

describe("deriveBrandTheme", () => {
  it("keeps the current raspberry look as the default", () => {
    const theme = defaultBrandTheme();
    expect(theme.h).toBeGreaterThan(345);
    expect(theme.h).toBeLessThan(355);
    expect(theme.l).toBeCloseTo(0.55, 1);
    expect(theme.c).toBeCloseTo(0.22, 1);
    expect(theme.fg).toContain("oklch(0.99");
    // Close to the #13080d the PWA manifest and splash screens were drawn with.
    const bg = parseHex(theme.themeColorHex) ?? [0, 0, 0];
    const was = parseHex("#13080D") ?? [0, 0, 0];
    bg.forEach((value, i) => expect(Math.abs(value - (was[i] ?? 0))).toBeLessThanOrEqual(3));
  });

  it("rejects an invalid, grey or too dark colour with a code", () => {
    expect(deriveBrandTheme("nope")).toEqual({ ok: false, error: "invalid_color" });
    expect(deriveBrandTheme("#808080")).toEqual({ ok: false, error: "too_gray" });
    expect(deriveBrandTheme("#FFFFFF")).toEqual({ ok: false, error: "too_gray" });
    expect(deriveBrandTheme("#2A0A1A")).toEqual({ ok: false, error: "too_dark" });
  });

  it("always gives the main button readable text and a visible button, for any usable hue", () => {
    for (let hue = 0; hue < 360; hue += 15) {
      for (const l of [0.5, 0.6, 0.7, 0.8, 0.9]) {
        const hex = toHex(oklchToRgb(l, 0.15, hue));
        const result = deriveBrandTheme(hex);
        if (!result.ok) continue;
        const { theme } = result;
        const button = oklchToRgb(theme.l, theme.c, theme.h);
        const fg = theme.fg.includes("0.99") ? oklchToRgb(0.99, 0.005, theme.h) : oklchToRgb(0.15, 0.02, theme.h);
        expect(contrastRatio(button, fg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(button, oklchToRgb(SURFACES.DARK_CARD.l, SURFACES.DARK_CARD.c, theme.h))).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps brand-coloured text readable on both themes for every hue", () => {
    for (let hue = 0; hue < 360; hue += 5) {
      const card = oklchToRgb(SURFACES.DARK_CARD.l, SURFACES.DARK_CARD.c, hue);
      const darkText = oklchToRgb(DARK_PRIMARY_TEXT.l, DARK_PRIMARY_TEXT.c, hue);
      expect(contrastRatio(darkText, card)).toBeGreaterThanOrEqual(4.5);

      const result = deriveBrandTheme(toHex(oklchToRgb(0.6, 0.15, hue)));
      if (!result.ok) continue;
      const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(result.theme.ink);
      const ink = oklchToRgb(Number(m?.[1]), Number(m?.[2]), Number(m?.[3]));
      expect(contrastRatio(ink, oklchToRgb(SURFACES.LIGHT_BACKGROUND.l, SURFACES.LIGHT_BACKGROUND.c, result.theme.h))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("writes the variables the stylesheet reads", () => {
    const css = brandThemeCss(defaultBrandTheme());
    expect(css).toMatch(/^:root\{--brand-h:[\d.]+;--brand-c:[\d.]+;--brand-l:[\d.]+;--brand-fg:oklch\(.+\);--brand-ink:oklch\(.+\)\}$/);
  });
});
