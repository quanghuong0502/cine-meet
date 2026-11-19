import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex } from "@/lib/brand-theme";
import { defaultRatingColor, inkOn, ratingColor } from "./age-rating-color";

describe("defaultRatingColor", () => {
  it("knows the Vietnamese codes, and the old C18 as T18", () => {
    expect(defaultRatingColor("P", 0)).toBe("#15803d");
    expect(defaultRatingColor("t16", 16)).toBe("#ea580c");
    expect(defaultRatingColor("C18", 18)).toBe(defaultRatingColor("T18", 18));
  });

  it("goes by the minimum age for a code it does not know", () => {
    expect(defaultRatingColor("X", 0)).toBe(defaultRatingColor("P", 0));
    expect(defaultRatingColor("X", 14)).toBe(defaultRatingColor("T13", 13));
    expect(defaultRatingColor("X", 21)).toBe(defaultRatingColor("T18", 18));
  });
});

describe("ratingColor", () => {
  it("prefers the saved colour and ignores a broken one", () => {
    expect(ratingColor({ code: "P", minAge: 0, color: "#123456" })).toBe("#123456");
    expect(ratingColor({ code: "P", minAge: 0, color: "red" })).toBe("#15803d");
    expect(ratingColor({ code: "T18", minAge: 18 })).toBe("#b91c1c");
  });
});

describe("inkOn", () => {
  it("keeps every default colour readable (at least 4.5:1)", () => {
    for (const code of ["P", "K", "T13", "T16", "T18", "C"]) {
      const color = defaultRatingColor(code, 0);
      const ink = parseHex(inkOn(color));
      const bg = parseHex(color);
      expect(ink && bg && contrastRatio(ink, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
