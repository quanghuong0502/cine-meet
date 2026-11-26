import { NO_SEAT, type LayoutConfig } from "./types";

/** Pure layout constants & row-label helpers (zero `zod` dependency for client bundles). */
export const MAX_ROWS = 40;
export const MAX_COLS = 60;
export const MIN_STEPS_PER_ROW = 1;
export const MAX_STEPS_PER_ROW = 4;
/** Most seats a row can put across one vertical aisle it runs through. */
export const MAX_FILL_SEATS = 3;
/** Default number of stair steps between consecutive raised rows. */
export const DEFAULT_STEPS_PER_ROW = 1;

const ALPHABET_ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET_NO_IO = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** A, B ... Z, AA, AB ... (skips I and O when `skipIO` is true). */
export function rowLabel(index: number, skipIO = false): string {
  const alpha = skipIO ? ALPHABET_NO_IO : ALPHABET_ALL;
  const n = alpha.length;
  return index < n ? alpha[index] : alpha[Math.floor(index / n) - 1] + alpha[index % n];
}

export function rowLabels(rows: number, skipIO = false): string[] {
  return Array.from({ length: rows }, (_, i) => rowLabel(i, skipIO));
}

/** Highest seat number a row can have: its base columns plus any seats placed across vertical aisles it runs through. */
export function maxColOfRow(
  config: Pick<LayoutConfig, "cols" | "rows" | "skipRowLetters" | "aisleFills">,
  label: string,
): number {
  const n = rowLabels(config.rows, config.skipRowLetters).indexOf(label) + 1;
  return config.cols + (config.aisleFills ?? []).reduce((sum, f) => sum + (f.rows.includes(n) ? f.seats : 0), 0);
}

export function defaultLayoutConfig(defaultSeatType: string): LayoutConfig {
  return {
    rows: 10,
    cols: 14,
    rowLabelOrder: "front_to_back",
    colNumbering: "left_to_right",
    defaultSeatType,
    screen: { positionPct: 50, widthPct: 85, distance: "medium", shape: "scope" },
    stadiumFromRow: 1,
    stepsPerRow: DEFAULT_STEPS_PER_ROW,
    aisles: { verticalAfterCols: [], horizontalAfterRows: [] },
    entrances: [{ side: "right", position: "back" }],
    overrides: [],
  };
}

export { NO_SEAT };
