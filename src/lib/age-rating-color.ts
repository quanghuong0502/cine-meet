import { contrastRatio, parseHex } from "@/lib/brand-theme";

/**
 * Default colours of the age ratings, a traffic-light scale: the stricter the rating, the warmer and more alarming the colour.
 * Vietnamese law (Thông tư 05/2023/TT-BVHTTDL) defines the ratings (P, K, T13, T16, T18) and how the label is shown, but no colours;
 * this scale is the common convention (South Korea's KMRB, for one, uses green, yellow, orange and red) and is only a starting point:
 * an admin can pick another colour per rating in the Catalog. The code is always printed too, so colour is never the only signal.
 */
const BY_CODE: Record<string, string> = {
  P: "#15803d", // green: everyone
  K: "#0369a1", // blue: under 13 only with a guardian
  T13: "#facc15", // yellow: 13 and over
  T16: "#ea580c", // orange: 16 and over
  T18: "#b91c1c", // red: 18 and over
  C: "#450a0a", // dark red: not allowed to be shown
};

/** The colour to start from: by code if it is a known one (C18 is the old name of T18), otherwise by minimum age. */
export function defaultRatingColor(code: string, minAge: number): string {
  const known = BY_CODE[code.trim().toUpperCase().replace(/^C(\d+)$/, "T$1")];
  if (known) return known;
  if (minAge >= 18) return BY_CODE.T18 as string;
  if (minAge >= 16) return BY_CODE.T16 as string;
  if (minAge >= 13) return BY_CODE.T13 as string;
  return BY_CODE.P as string;
}

/** The colour a rating shows: the one an admin saved, else the default for its code and age. */
export function ratingColor(rating: { code: string; minAge: number; color?: string | null }): string {
  return rating.color && parseHex(rating.color) ? rating.color : defaultRatingColor(rating.code, rating.minAge);
}

/** Near-black or white text, whichever reads better on the colour. */
export function inkOn(color: string): string {
  const rgb = parseHex(color);
  if (!rgb) return "#ffffff";
  return contrastRatio(rgb, [255, 255, 255]) >= contrastRatio(rgb, [20, 20, 20]) ? "#ffffff" : "#141414";
}
