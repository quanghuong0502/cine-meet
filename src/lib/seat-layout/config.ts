import { z } from "zod";
import {
  DEFAULT_STEPS_PER_ROW,
  MAX_COLS,
  MAX_FILL_SEATS,
  MAX_ROWS,
  MAX_STEPS_PER_ROW,
  MIN_STEPS_PER_ROW,
  maxColOfRow,
  rowLabels,
} from "./config.constants";
import { roomDimensionOverridesSchema } from "./dimensions";

export {
  DEFAULT_STEPS_PER_ROW,
  defaultLayoutConfig,
  MAX_COLS,
  MAX_FILL_SEATS,
  MAX_ROWS,
  MAX_STEPS_PER_ROW,
  maxColOfRow,
  MIN_STEPS_PER_ROW,
  NO_SEAT,
  rowLabel,
  rowLabels,
} from "./config.constants";

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
    skipRowLetters: z.boolean().optional(),
    colNumbering: z.enum(["left_to_right", "right_to_left"]),
    defaultSeatType: z.string().min(1),
    screen: z.object({
      positionPct: z.number().min(0).max(100),
      widthPct: z.number().min(30).max(100),
      distance: z.enum(["near", "medium", "far"]),
      shape: z.enum(["scope", "standard", "square"]).optional(),
      mount: z.enum(["low", "mid", "high"]).optional(),
      tilt: z.enum(["flat", "slight", "tilted"]).optional(),
      curved: z.boolean().optional(),
    }),
    seatRecline: z.enum(["upright", "slight", "deep"]).optional(),
    rowCurve: z.enum(["straight", "curved"]).optional(),
    seatStagger: z.enum(["aligned", "staggered"]).optional(),
    rowPitch: z
      .preprocess((v) => (v === "spacious" ? "vip" : v), z.enum(["tight", "standard", "vip", "bed"]).optional())
      .optional(),
    dimensions: roomDimensionOverridesSchema,
    stadiumFromRow: z.number().int().min(1).max(MAX_ROWS).nullable(),
    stepsPerRow: z.number().int().min(MIN_STEPS_PER_ROW).max(MAX_STEPS_PER_ROW).default(DEFAULT_STEPS_PER_ROW),
    aisles: z.object({
      verticalAfterCols: uniqueInts(1, MAX_COLS),
      horizontalAfterRows: uniqueInts(1, MAX_ROWS),
      sideAisles: z
        .array(z.enum(["left", "right"]))
        .max(2)
        .refine((list) => new Set(list).size === list.length, "duplicate")
        .optional(),
    }),
    aisleFills: z
      .array(
        z.object({
          afterCol: z.number().int().min(1).max(MAX_COLS),
          seats: z.number().int().min(1).max(MAX_FILL_SEATS),
          rows: uniqueInts(1, MAX_ROWS).refine((list) => list.length > 0, "empty"),
        }),
      )
      .max(MAX_COLS)
      .optional(),
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
          cols: z.array(z.number().int().min(1).max(MAX_COLS + MAX_COLS * MAX_FILL_SEATS)).min(1).max(MAX_COLS * 2),
          type: z.string().min(1).optional(),
          flags: z.array(flagSchema).max(3).optional(),
        }),
      )
      .max(2000),
  })
  .superRefine((cfg, ctx) => {
    const labels = new Set(rowLabels(cfg.rows, cfg.skipRowLetters));
    cfg.aisles.verticalAfterCols.forEach((n, i) => {
      if (n >= cfg.cols) ctx.addIssue({ code: "custom", path: ["aisles", "verticalAfterCols", i], message: "out_of_range" });
    });
    cfg.aisles.horizontalAfterRows.forEach((n, i) => {
      if (n >= cfg.rows) ctx.addIssue({ code: "custom", path: ["aisles", "horizontalAfterRows", i], message: "out_of_range" });
    });
    const seenFills = new Set<number>();
    (cfg.aisleFills ?? []).forEach((f, i) => {
      if (!cfg.aisles.verticalAfterCols.includes(f.afterCol)) {
        ctx.addIssue({ code: "custom", path: ["aisleFills", i, "afterCol"], message: "out_of_range" });
      }
      if (seenFills.has(f.afterCol)) {
        ctx.addIssue({ code: "custom", path: ["aisleFills", i, "afterCol"], message: "duplicate" });
      }
      seenFills.add(f.afterCol);
      if (f.rows.some((n) => n > cfg.rows)) {
        ctx.addIssue({ code: "custom", path: ["aisleFills", i, "rows"], message: "out_of_range" });
      }
    });
    if (cfg.stadiumFromRow !== null && cfg.stadiumFromRow > cfg.rows) {
      ctx.addIssue({ code: "custom", path: ["stadiumFromRow"], message: "out_of_range" });
    }
    cfg.overrides.forEach((o, i) => {
      if (!labels.has(o.row)) ctx.addIssue({ code: "custom", path: ["overrides", i, "row"], message: "unknown_row" });
      else if (o.cols.some((c) => c > maxColOfRow(cfg, o.row))) {
        ctx.addIssue({ code: "custom", path: ["overrides", i, "cols"], message: "out_of_range" });
      }
    });
  });
