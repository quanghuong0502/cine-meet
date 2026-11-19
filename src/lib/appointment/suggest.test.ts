import { describe, expect, it } from "vitest";
import { suggestTogether, type SuggestSeat } from "./suggest";

const seat = (row: number, col: number, score: number, extra: Partial<SuggestSeat> = {}): SuggestSeat => ({
  code: `${String.fromCharCode(65 + row)}${col + 1}`,
  rowIndex: row,
  colIndex: col,
  span: 1,
  score,
  flags: [],
  ...extra,
});

describe("suggestTogether", () => {
  it("picks the neighbouring run with the best score", () => {
    const seats = [seat(0, 0, 5), seat(0, 1, 5), seat(1, 0, 9), seat(1, 1, 9)];
    expect(suggestTogether(seats, new Set(), 2)).toEqual(["B1", "B2"]);
  });
  it("skips taken and broken seats and keeps the run unbroken", () => {
    const seats = [seat(0, 0, 9), seat(0, 1, 9, { flags: ["broken"] }), seat(0, 2, 9), seat(0, 3, 9)];
    expect(suggestTogether(seats, new Set(), 2)).toEqual(["A3", "A4"]);
    expect(suggestTogether(seats, new Set(["A3"]), 2)).toBeNull();
  });
  it("counts a couple seat as two people", () => {
    const seats = [seat(0, 0, 8, { span: 2 })];
    expect(suggestTogether(seats, new Set(), 2)).toEqual(["A1"]);
  });
  it("returns null when nothing fits", () => {
    expect(suggestTogether([seat(0, 0, 5)], new Set(), 2)).toBeNull();
  });
});
