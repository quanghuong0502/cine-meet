import { describe, expect, it } from "vitest";
import { defaultLayoutConfig } from "./config";
import { generateGrid } from "./generate";
import { cellsOfSeat, patchCells, pruneConfig, removedCells, resetCells } from "./overrides";
import type { SeatTypeInfo } from "./types";

const TYPES: SeatTypeInfo[] = [
  { id: "std", name: "Thường", capacity: 1 },
  { id: "vip", name: "VIP", capacity: 1 },
];
const cells = (row: string, ...cols: number[]) => cols.map((col) => ({ row, col }));

describe("patchCells", () => {
  it("merges cells of the same state into one override per row", () => {
    const result = patchCells([], cells("A", 3, 1, 2), { type: "vip" }, "std");
    expect(result).toEqual([{ row: "A", cols: [1, 2, 3], type: "vip" }]);
  });

  it("keeps the type when only a flag changes, and merges flag changes back", () => {
    let o = patchCells([], cells("B", 1, 2), { type: "vip" }, "std");
    o = patchCells(o, cells("B", 2), { flag: { name: "broken", on: true } }, "std");
    expect(o).toEqual([
      { row: "B", cols: [1], type: "vip" },
      { row: "B", cols: [2], type: "vip", flags: ["broken"] },
    ]);
    o = patchCells(o, cells("B", 2), { flag: { name: "broken", on: false } }, "std");
    expect(o).toEqual([{ row: "B", cols: [1, 2], type: "vip" }]);
  });

  it("drops an override that is back to the default", () => {
    const o = patchCells(patchCells([], cells("A", 1), { type: "vip" }, "std"), cells("A", 1), { type: "std" }, "std");
    expect(o).toEqual([]);
  });

  it("removing a seat clears its flags and ignores flags on empty cells", () => {
    let o = patchCells([], cells("A", 1), { flag: { name: "broken", on: true } }, "std");
    o = patchCells(o, cells("A", 1), { type: "none" }, "std");
    expect(o).toEqual([{ row: "A", cols: [1], type: "none" }]);
    o = patchCells(o, cells("A", 1), { flag: { name: "obstructed", on: true } }, "std");
    expect(o).toEqual([{ row: "A", cols: [1], type: "none" }]);
    expect(removedCells(o)).toEqual(cells("A", 1));
  });

  it("brings a removed seat back by setting a type", () => {
    const o = patchCells(patchCells([], cells("A", 1), { type: "none" }, "std"), cells("A", 1), { type: "std" }, "std");
    expect(o).toEqual([]);
  });

  it("produces overrides that generate the same seats as the originals", () => {
    const base = { ...defaultLayoutConfig("std"), rows: 4, cols: 6 };
    const original = [
      { row: "A", cols: [1, 2], type: "vip" },
      { row: "A", cols: [2], flags: ["broken" as const] },
      { row: "B", cols: [3], type: "none" },
    ];
    const compact = patchCells(original, [], {}, "std");
    expect(generateGrid({ ...base, overrides: compact }, TYPES).seats).toEqual(generateGrid({ ...base, overrides: original }, TYPES).seats);
  });
});

describe("resetCells and pruneConfig", () => {
  it("resets chosen cells only", () => {
    const o = patchCells([], cells("A", 1, 2, 3), { type: "vip" }, "std");
    expect(resetCells(o, cells("A", 2))).toEqual([{ row: "A", cols: [1, 3], type: "vip" }]);
  });

  it("prunes overrides, aisles and stadium row after the grid shrinks", () => {
    const config = {
      ...defaultLayoutConfig("std"),
      rows: 3,
      cols: 4,
      stadiumFromRow: 5,
      aisles: { verticalAfterCols: [2, 4, 9], horizontalAfterRows: [1, 3] },
      overrides: [
        { row: "A", cols: [1, 9], type: "vip" },
        { row: "F", cols: [1], type: "none" },
      ],
    };
    const pruned = pruneConfig(config);
    expect(pruned.stadiumFromRow).toBeNull();
    expect(pruned.aisles).toEqual({ verticalAfterCols: [2], horizontalAfterRows: [1] });
    expect(pruned.overrides).toEqual([{ row: "A", cols: [1], type: "vip" }]);
  });
});

describe("cellsOfSeat", () => {
  it("covers two cells for a couple seat", () => {
    expect(cellsOfSeat({ row: "J", col: 5, span: 2 })).toEqual(cells("J", 5, 6));
  });
});
