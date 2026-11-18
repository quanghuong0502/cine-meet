/** Seat-layout config and generated seat shapes (pure types, shared by server and client). */

export type RowLabelOrder = "front_to_back" | "back_to_front";
export type ColNumbering = "left_to_right" | "right_to_left";
export type ScreenDistance = "near" | "medium" | "far";
export type EntranceSide = "left" | "center" | "right";
export type EntrancePosition = "front" | "back";
export type SeatFlag = "broken" | "obstructed";

/** Value of an override `type` that removes the seat (empty cell, pillar). */
export const NO_SEAT = "none";

export interface SeatOverride {
  /** Row label, e.g. "J". */
  row: string;
  /** Column numbers as printed on the seats (follows `colNumbering`). */
  cols: number[];
  /** A seatType id, or `NO_SEAT`. Omitted = keep the current type. */
  type?: string;
  /** Omitted = keep current flags; `[]` clears them. */
  flags?: SeatFlag[];
}

/**
 * Layout config.
 * - `verticalAfterCols`: aisle between column number N and N+1 (in numbering order).
 * - `horizontalAfterRows`: aisle between the Nth and (N+1)th row in label order (A = 1).
 * - `stadiumFromRow`: rows counted from the screen (1 = front row); rows from here back are raised.
 *   `null` = no stadium information (all rows treated alike).
 * - `stepsPerRow`: how many steps rise between two raised rows (1 to 4); old layouts without it count as 2.
 */
export interface LayoutConfig {
  rows: number;
  cols: number;
  rowLabelOrder: RowLabelOrder;
  colNumbering: ColNumbering;
  /** Default seatType id for every cell without an override. */
  defaultSeatType: string;
  screen: { positionPct: number; widthPct: number; distance: ScreenDistance };
  stadiumFromRow: number | null;
  /** Steps between two raised rows (each step about `STEP_HEIGHT_M`); only meaningful when `stadiumFromRow` is set. */
  stepsPerRow: number;
  aisles: { verticalAfterCols: number[]; horizontalAfterRows: number[] };
  entrances: { side: EntranceSide; position: EntrancePosition }[];
  overrides: SeatOverride[];
}

export interface SeatTypeInfo {
  id: string;
  name: string;
  /** 1 = single seat, 2 = couple seat (one seat spanning two cells). */
  capacity: number;
}

export interface GridSeat {
  /** Row label + lowest column number covered, e.g. "J5". */
  code: string;
  row: string;
  col: number;
  /** Physical row counted from the screen, 0-based. */
  rowIndex: number;
  /** Physical column counted from the left, 0-based (left-most cell if span 2). */
  colIndex: number;
  type: string;
  /** Number of cells the seat covers (2 for a couple seat). */
  span: 1 | 2;
  /** Centre in layout units (1 unit = one seat pitch); screen is at y = 0. */
  x: number;
  y: number;
  flags: SeatFlag[];
}

export interface LayoutSeat extends GridSeat {
  /** 0 to 100, see `src/services/seat-score.ts`. */
  score: number;
}

export interface LayoutGeometry {
  width: number;
  height: number;
  screen: { x1: number; x2: number; y: number };
  /** x of each vertical aisle's centre. */
  verticalAisles: number[];
  /** y of each horizontal aisle's centre. */
  horizontalAisles: number[];
  entrances: { side: EntranceSide; position: EntrancePosition; x: number; y: number }[];
  /** Centre x of each physical column (from the left) and centre y of each physical row (from the screen). */
  colX: number[];
  rowY: number[];
  /** y of the first and last row centres. */
  firstRowY: number;
  lastRowY: number;
  /** Labels in physical order from the screen. */
  rowLabels: string[];
  /** Column numbers in physical order from the left. */
  colNumbers: number[];
}
