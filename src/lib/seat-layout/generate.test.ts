import { describe, expect, it } from "vitest";
import { defaultLayoutConfig, layoutConfigSchema, rowLabel } from "./config";
import { generateGrid } from "./generate";
import { buildLayoutSummary } from "./summary";
import { scoreSeats } from "@/services/seat-score";
import type { LayoutConfig, SeatTypeInfo } from "./types";

const TYPES: SeatTypeInfo[] = [
  { id: "std", name: "Thường", capacity: 1 },
  { id: "couple", name: "Đôi", capacity: 2 },
];

function config(patch: Partial<LayoutConfig> = {}): LayoutConfig {
  return { ...defaultLayoutConfig("std"), rows: 4, cols: 6, ...patch };
}

describe("rowLabel", () => {
  it("runs A..Z then AA, AB", () => {
    expect([rowLabel(0), rowLabel(25), rowLabel(26), rowLabel(27), rowLabel(51), rowLabel(52)]).toEqual([
      "A", "Z", "AA", "AB", "AZ", "BA",
    ]);
  });
});

describe("generateGrid", () => {
  it("creates rows × cols seats with codes", () => {
    const { seats } = generateGrid(config(), TYPES);
    expect(seats).toHaveLength(24);
    expect(seats[0].code).toBe("A1");
    expect(seats[23].code).toBe("D6");
  });

  it("puts row A at the back when order is back_to_front", () => {
    const { seats } = generateGrid(config({ rowLabelOrder: "back_to_front" }), TYPES);
    const a1 = seats.find((s) => s.code === "A1")!;
    const d1 = seats.find((s) => s.code === "D1")!;
    expect(a1.y).toBeGreaterThan(d1.y);
  });

  it("numbers columns right to left", () => {
    const { seats } = generateGrid(config({ colNumbering: "right_to_left" }), TYPES);
    const one = seats.find((s) => s.code === "A1")!;
    const six = seats.find((s) => s.code === "A6")!;
    expect(one.x).toBeGreaterThan(six.x);
  });

  it("widens the room by aisles, in numbering order", () => {
    const plain = generateGrid(config(), TYPES).geometry;
    const aisle = generateGrid(config({ aisles: { verticalAfterCols: [3], horizontalAfterRows: [2] } }), TYPES);
    expect(aisle.geometry.width).toBeCloseTo(plain.width + 0.8);
    expect(aisle.geometry.height).toBeCloseTo(plain.height + 0.8);
    const a3 = aisle.seats.find((s) => s.code === "A3")!;
    const a4 = aisle.seats.find((s) => s.code === "A4")!;
    expect(a4.x - a3.x).toBeCloseTo(1.8);
    // With right-to-left numbering "after col 3" sits between numbers 3 and 4 as well.
    const rtl = generateGrid(
      config({ colNumbering: "right_to_left", aisles: { verticalAfterCols: [3], horizontalAfterRows: [] } }),
      TYPES,
    );
    const r3 = rtl.seats.find((s) => s.code === "A3")!;
    const r4 = rtl.seats.find((s) => s.code === "A4")!;
    expect(r3.x - r4.x).toBeCloseTo(1.8);
  });

  it("removes seats overridden as none and keeps flags", () => {
    const { seats } = generateGrid(
      config({
        overrides: [
          { row: "A", cols: [1], type: "none" },
          { row: "B", cols: [2], flags: ["broken"] },
        ],
      }),
      TYPES,
    );
    expect(seats).toHaveLength(23);
    expect(seats.find((s) => s.code === "A1")).toBeUndefined();
    expect(seats.find((s) => s.code === "B2")!.flags).toEqual(["broken"]);
  });

  it("pairs couple cells into one seat spanning two cells", () => {
    const { seats } = generateGrid(config({ overrides: [{ row: "D", cols: [1, 2, 3, 4, 5], type: "couple" }] }), TYPES);
    const couples = seats.filter((s) => s.type === "couple");
    expect(couples.map((s) => s.code)).toEqual(["D1", "D3", "D5"]);
    expect(couples[0].span).toBe(2);
    expect(couples[0].x).toBeCloseTo(1);
    // The fifth couple cell has no partner: stays a one-cell seat.
    const leftover = seats.find((s) => s.code === "D5")!;
    expect(leftover.span).toBe(1);
  });

  it("does not pair couple cells across an aisle", () => {
    const { seats } = generateGrid(
      config({
        aisles: { verticalAfterCols: [1], horizontalAfterRows: [] },
        overrides: [{ row: "D", cols: [1, 2], type: "couple" }],
      }),
      TYPES,
    );
    expect(seats.filter((s) => s.type === "couple").every((s) => s.span === 1)).toBe(true);
  });

  it("moves the screen with the slider and keeps it inside the room", () => {
    const left = generateGrid(config({ screen: { positionPct: 0, widthPct: 50, distance: "medium" } }), TYPES).geometry;
    const mid = generateGrid(config({ screen: { positionPct: 50, widthPct: 50, distance: "medium" } }), TYPES).geometry;
    const right = generateGrid(config({ screen: { positionPct: 100, widthPct: 50, distance: "medium" } }), TYPES).geometry;
    const centre = (g: typeof mid) => (g.screen.x1 + g.screen.x2) / 2;
    expect(centre(left)).toBeLessThan(centre(mid));
    expect(centre(mid)).toBeCloseTo(mid.width / 2);
    expect(centre(right)).toBeGreaterThan(centre(mid));
    expect(left.screen.x1).toBeGreaterThanOrEqual(0);
    expect(right.screen.x2).toBeLessThanOrEqual(right.width);
  });
});

describe("scoreSeats", () => {
  const base = () => config({ rows: 10, cols: 16, entrances: [] });
  const scoreOf = (cfg: LayoutConfig, code: string) => {
    const { seats, geometry } = generateGrid(cfg, TYPES);
    return scoreSeats(seats, cfg, geometry).find((s) => s.code === code)!.score;
  };

  it("gives a seat near the ideal spot a higher score than a side seat", () => {
    expect(scoreOf(base(), "G8")).toBeGreaterThan(scoreOf(base(), "G1"));
  });

  it("prefers the ideal depth over the front row", () => {
    expect(scoreOf(base(), "G8")).toBeGreaterThan(scoreOf(base(), "A8"));
  });

  it("penalizes broken and obstructed seats", () => {
    const ok = scoreOf(base(), "G8");
    const broken = scoreOf({ ...base(), overrides: [{ row: "G", cols: [8], flags: ["broken"] }] }, "G8");
    const blocked = scoreOf({ ...base(), overrides: [{ row: "G", cols: [8], flags: ["obstructed"] }] }, "G8");
    expect(broken).toBeLessThan(ok - 40);
    expect(blocked).toBeLessThan(ok);
    expect(blocked).toBeGreaterThan(broken);
  });

  it("moves the best seats with the screen slider", () => {
    const toRight = { ...base(), screen: { positionPct: 90, widthPct: 60, distance: "medium" as const } };
    expect(scoreOf(toRight, "G14")).toBeGreaterThan(scoreOf(toRight, "G3"));
    const toLeft = { ...base(), screen: { positionPct: 10, widthPct: 60, distance: "medium" as const } };
    expect(scoreOf(toLeft, "G3")).toBeGreaterThan(scoreOf(toLeft, "G14"));
  });

  it("penalizes flat rows before the stadium and seats right at an entrance", () => {
    const flat = scoreOf({ ...base(), stadiumFromRow: 4 }, "C8");
    expect(flat).toBeLessThan(scoreOf(base(), "C8"));
    const door = scoreOf({ ...base(), entrances: [{ side: "right", position: "back" }] }, "J16");
    expect(door).toBeLessThan(scoreOf(base(), "J16"));
  });

  it("stays between 0 and 100", () => {
    const cfg = { ...base(), overrides: [{ row: "A", cols: [1], flags: ["broken" as const, "obstructed" as const] }] };
    const { seats, geometry } = generateGrid(cfg, TYPES);
    for (const s of scoreSeats(seats, cfg, geometry)) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("layoutConfigSchema", () => {
  it("accepts the default config", () => {
    expect(layoutConfigSchema.safeParse(defaultLayoutConfig("std")).success).toBe(true);
  });

  it("rejects an unknown row, an aisle after the last column and a bad override column", () => {
    const bad = {
      ...defaultLayoutConfig("std"),
      aisles: { verticalAfterCols: [14], horizontalAfterRows: [] },
      overrides: [{ row: "Z", cols: [1], type: "none" }, { row: "A", cols: [99], type: "none" }],
    };
    const result = layoutConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildLayoutSummary", () => {
  it("describes size, screen, aisles, entrance and the best zone", () => {
    const cfg = config({
      rows: 10,
      cols: 16,
      screen: { positionPct: 58, widthPct: 85, distance: "medium" },
      aisles: { verticalAfterCols: [3, 13], horizontalAfterRows: [4] },
      stadiumFromRow: 3,
      overrides: [{ row: "J", cols: [5, 6, 7, 8], type: "couple" }],
    });
    const { seats, geometry } = generateGrid(cfg, TYPES);
    const text = buildLayoutSummary(cfg, geometry, scoreSeats(seats, cfg, geometry), TYPES);
    expect(text).toContain("10 hàng (A đến J");
    expect(text).toContain("Thường 156");
    expect(text).toContain("Đôi 2");
    expect(text).toContain("lệch phải (58%)");
    expect(text).toContain("lối đi dọc sau cột 3, 13");
    expect(text).toContain("lối đi ngang sau hàng D");
    expect(text).toContain("Bậc thang từ hàng thứ 3");
    expect(text).toContain("phải-sau");
    expect(text).toContain("Vùng điểm cao");
  });
});
