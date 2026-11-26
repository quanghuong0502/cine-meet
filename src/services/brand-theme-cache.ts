import { unstable_cache } from "next/cache";
import { cache } from "react";
import { brandThemeCss, defaultBrandTheme, deriveBrandTheme, type BrandTheme } from "@/lib/brand-theme";
import { getBrandColor } from "./brand-color.service";

/** Cache tag of the brand colour; the save and reset actions expire it with `updateTag`. */
export const BRAND_THEME_TAG = "settings:brand-color";

export interface BrandThemeData {
  hex: string;
  theme: BrandTheme;
  /** `:root{--brand-h:...}`: the stylesheet the root layout puts in the head. */
  css: string;
}

async function loadBrandTheme(): Promise<BrandThemeData> {
  const hex = await getBrandColor();
  const derived = deriveBrandTheme(hex);
  const theme = derived.ok ? derived.theme : defaultBrandTheme();
  return { hex, theme, css: brandThemeCss(theme) };
}

const cached = unstable_cache(loadBrandTheme, ["brand-theme"], { tags: [BRAND_THEME_TAG], revalidate: 3600 });

/**
 * The brand theme for the root layout, the viewport and the manifest: shared by everyone, changes rarely, so it is cached across
 * requests (plain strings and numbers only). If the database cannot be reached the default colour is used, so no page ever fails because of it.
 */
export const getBrandTheme = cache(async (): Promise<BrandThemeData> => {
  try {
    return await cached();
  } catch {
    const theme = defaultBrandTheme();
    return { hex: "#C61583", theme, css: brandThemeCss(theme) };
  }
});
