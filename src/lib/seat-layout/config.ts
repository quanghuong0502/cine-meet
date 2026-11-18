import { z } from "zod";
import { NO_SEAT, type LayoutConfig } from "./types";

export const MAX_ROWS = 40;
export const MAX_COLS = 60;
export const MIN_STEPS_PER_ROW = 1;
export const MAX_STEPS_PER_ROW = 4;
/** What layouts saved before the field existed are read as (about the 0.2 m rise the score used to assume). */
export const DEFAULT_STEPS_PER_ROW = 2;

/** A, B ... Z, AA, AB ... */
export function rowLabel(index: number): string {
  const letter = (n: number) => String.fromCharCode(65 + n);
  return index < 26 ? letter(index) : letter(Math.floor(index / 26) - 1) + letter(index % 26);
}

export function rowLabels(rows: number): string[] {
  return Array.from({ length: rows }, (_, i) => rowLabel(i));
}

const flagSchema = z.enum(["broken", "obstructed", "recommended"]);
const uniqueInts = (min: number, max: number) =>
  z
    .array(z.number().int().min(min).max(max))
    .max(MAX_COLS)
    .refine((list) => new Set(list).size === list.length, "duplicate");

export const layoutConfigSchema = z
  .object({
    rows: z.number().int().min(1).max(MAX_ROWS),
    cols: z.number().int().min(1).max(MAX_COLS),
    rowLabelOrder: z.enum(["front_to_back", "back_to_front"]),
    colNumbering: z.enum(["left_to_right", "right_to_left"]),
    defaultSeatType: z.string().min(1),
    screen: z.object({
      positionPct: z.number().min(0).max(100),
      widthPct: z.number().min(30).max(100),
      distance: z.enum(["near", "medium", "far"]),
    }),
    stadiumFromRow: z.number().int().min(1).max(MAX_ROWS).nullable(),
    stepsPerRow: z.number().int().min(MIN_STEPS_PER_ROW).max(MAX_STEPS_PER_ROW).default(DEFAULT_STEPS_PER_ROW),
    aisles: z.object({
      verticalAfterCols: uniqueInts(1, MAX_COLS),
      horizontalAfterRows: uniqueInts(1, MAX_ROWS),
    }),
    entrances: z
      .array(
        z.object({
          side: z.enum(["left", "center", "right"]),
          position: z.enum(["front", "back"]),
        }),
      )
      .max(6),
    overrides: z
      .array(
        z.object({
          row: z.string().min(1).max(3),
          cols: z.array(z.number().int().min(1).max(MAX_COLS)).min(1).max(MAX_COLS),
          type: z.string().min(1).optional(),
          flags: z.array(flagSchema).max(3).optional(),
        }),
      )
      .max(2000),
  })
  .superRefine((cfg, ctx) => {
    const labels = new Set(rowLabels(cfg.rows));
    cfg.aisles.verticalAfterCols.forEach((n, i) => {
      if (n >= cfg.cols) ctx.addIssue({ code: "custom", path: ["aisles", "verticalAfterCols", i], message: "out_of_range" });
    });
    cfg.aisles.horizontalAfterRows.forEach((n, i) => {
      if (n >= cfg.rows) ctx.addIssue({ code: "custom", path: ["aisles", "horizontalAfterRows", i], message: "out_of_range" });
    });
    if (cfg.stadiumFromRow !== null && cfg.stadiumFromRow > cfg.rows) {
      ctx.addIssue({ code: "custom", path: ["stadiumFromRow"], message: "out_of_range" });
    }
    cfg.overrides.forEach((o, i) => {
      if (!labels.has(o.row)) ctx.addIssue({ code: "custom", path: ["overrides", i, "row"], message: "unknown_row" });
      if (o.cols.some((c) => c > cfg.cols)) ctx.addIssue({ code: "custom", path: ["overrides", i, "cols"], message: "out_of_range" });
    });
  });

export function defaultLayoutConfig(defaultSeatType: string): LayoutConfig {
  return {
    rows: 10,
    cols: 14,
    rowLabelOrder: "front_to_back",
    colNumbering: "left_to_right",
    defaultSeatType,
    screen: { positionPct: 50, widthPct: 85, distance: "medium" },
    stadiumFromRow: null,
    stepsPerRow: DEFAULT_STEPS_PER_ROW,
    aisles: { verticalAfterCols: [], horizontalAfterRows: [] },
    entrances: [{ side: "right", position: "back" }],
    overrides: [],
  };
}

export { NO_SEAT };
