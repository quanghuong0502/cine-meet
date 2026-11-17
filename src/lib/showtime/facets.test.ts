import { describe, expect, it } from "vitest";
import { availableValues, countMatching, type FacetRecord } from "./facets";

const records: FacetRecord[] = [
  { branch: "b1", format: "2d", genre: ["comedy"], slot: ["evening"] },
  { branch: "b1", format: "imax", genre: ["action", "comedy"], slot: ["late"] },
  { branch: "b2", format: "2d", genre: ["action"], slot: ["morning"] },
];

describe("availableValues", () => {
  it("offers every value present when nothing is chosen", () => {
    const available = availableValues(records, {});
    expect([...available.branch].sort()).toEqual(["b1", "b2"]);
    expect([...available.format].sort()).toEqual(["2d", "imax"]);
    expect([...available.genre].sort()).toEqual(["action", "comedy"]);
    expect([...available.slot].sort()).toEqual(["evening", "late", "morning"]);
  });

  it("limits a group by the other groups' choices", () => {
    const available = availableValues(records, { branch: "b2" });
    expect([...available.format]).toEqual(["2d"]);
    expect([...available.slot]).toEqual(["morning"]);
  });

  it("does not limit a group by its own choice, so the person can switch", () => {
    const available = availableValues(records, { branch: "b2" });
    expect([...available.branch].sort()).toEqual(["b1", "b2"]);
  });

  it("matches a movie with several genres on any of them", () => {
    const available = availableValues(records, { genre: "comedy" });
    expect([...available.branch]).toEqual(["b1"]);
    expect([...available.format].sort()).toEqual(["2d", "imax"]);
  });
});

describe("countMatching", () => {
  it("counts the showtimes left by all choices", () => {
    expect(countMatching(records, {})).toBe(3);
    expect(countMatching(records, { branch: "b1", genre: "action" })).toBe(1);
    expect(countMatching(records, { branch: "b2", format: "imax" })).toBe(0);
  });
});
