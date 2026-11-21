import { describe, expect, it } from "vitest";
import { availableCinemaValues, countCinemas, filterCinemas, type CinemaFacet } from "@/lib/cinema/filters";

const records: CinemaFacet[] = [
  { brand: "cgv", format: ["2d", "imax"], frequent: ["1"] },
  { brand: "cgv", format: ["2d"], frequent: [] },
  { brand: "lotte", format: ["2d", "4dx"], frequent: [] },
];

describe("cinema filters", () => {
  it("keeps branches that pass every filter", () => {
    expect(filterCinemas(records, { brand: "cgv", format: "imax" })).toHaveLength(1);
    expect(countCinemas(records, { frequent: "1" })).toBe(1);
    expect(countCinemas(records, {})).toBe(3);
  });
  it("offers only choices that still lead to a result", () => {
    const available = availableCinemaValues(records, { brand: "lotte" });
    expect([...available.format].sort()).toEqual(["2d", "4dx"]);
    expect([...available.brand].sort()).toEqual(["cgv", "lotte"]);
  });
});
