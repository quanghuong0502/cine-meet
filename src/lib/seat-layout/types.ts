/** Seat-layout config and generated seat shapes (pure types, shared by server and client). */

import type { RoomDimensionOverrides } from "./dimensions";

export type RowLabelOrder = "front_to_back" | "back_to_front";
export type ColNumbering = "left_to_right" | "right_to_left";
export type ScreenDistance = "near" | "medium" | "far";
/** Physical screen and seat traits used by both seat scoring (shape, mount, tilt, recline) and the 3D view. */
export type ScreenShape = "scope" | "standard" | "square";
export type ScreenMount = "low" | "mid" | "high";
export type ScreenTilt = "flat" | "slight" | "tilted";
export type SeatRecline = "upright" | "slight" | "deep";
export type RowCurve = "straight" | "curved";
/** Whether alternating rows shift by half a seat pitch so viewers look between heads ahead. */
export type SeatStagger = "aligned" | "staggered";
/** Row-to-row spacing (legroom depth) calibrated to TCVN 5577 & commercial seating tiers. */
export type RowPitch = "tight" | "standard" | "vip" | "bed";
/** Chair silhouette rendered in 3D, configured once on the SeatType master data. */
export type SeatStyle = "standard" | "vip" | "recliner" | "bed" | "4dx";
export const SCREEN_SHAPES: readonly ScreenShape[] = ["scope", "standard", "square"];
export const SCREEN_MOUNTS: readonly ScreenMount[] = ["low", "mid", "high"];
export const SCREEN_TILTS: readonly ScreenTilt[] = ["flat", "slight", "tilted"];
export const SEAT_RECLINES: readonly SeatRecline[] = ["upright", "slight", "deep"];
export const ROW_CURVES: readonly RowCurve[] = ["straight", "curved"];
export const SEAT_STAGGERS: readonly SeatStagger[] = ["aligned", "staggered"];
export const ROW_PITCHES: readonly RowPitch[] = ["tight", "standard", "vip", "bed"];
export const SEAT_STYLES: readonly SeatStyle[] = ["standard", "vip", "recliner", "bed", "4dx"];
export type EntranceSide = "left" | "center" | "right";
export type EntrancePosition = "front" | "back";
/** Vertical walkway running along the outer wall (outside the first/last seat column). */
export type SideAisle = "left" | "right";
export const SIDE_AISLES: readonly SideAisle[] = ["left", "right"];
/** `recommended` = a seat the admin advises sitting in; a note only, it does not change the seat score. */
export type SeatFlag = "broken" | "obstructed" | "recommended";

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
 * A vertical aisle that selected rows run straight through (e.g. the back Sweetbox row): those rows place `seats`
 * seats inside the gap, and the aisle is widened to `seats` seat pitches so the remaining rows keep an empty walkway.
 */
export interface AisleFill {
  /** Column number before the vertical aisle (must exist in `aisles.verticalAfterCols`). */
  afterCol: number;
  /** Number of seats placed across the aisle in the listed rows (1 to 3). */
  seats: number;
  /** 1-based row numbers in label order (first row = 1), matching `horizontalAfterRows`. */
  rows: number[];
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
  /** Skip letters I and O when labelling rows (common in Vietnamese cinemas to avoid confusion with 1 and 0). */
  skipRowLetters?: boolean;
  colNumbering: ColNumbering;
  /** Default seatType id for every cell without an override. */
  defaultSeatType: string;
  screen: {
    positionPct: number;
    widthPct: number;
    distance: ScreenDistance;
    shape?: ScreenShape;
    mount?: ScreenMount;
    /** Downward tilt of the screen's top edge toward the audience; omitted = vertical (0°). */
    tilt?: ScreenTilt;
    curved?: boolean;
  };
  /** How far seats lean back; omitted = standard cinema backrest tilt. */
  seatRecline?: SeatRecline;
  /** Whether seat rows curve gently toward the screen in 3D; omitted = straight rows. */
  rowCurve?: RowCurve;
  /** Whether alternating rows are offset by half a seat pitch; omitted = aligned columns. */
  seatStagger?: SeatStagger;
  /** Depth between consecutive rows; omitted = standard (~1.1 m). */
  rowPitch?: RowPitch;
  /** Optional per-room physical dimension overrides (metres / ratio); omitted fields inherit system defaults. */
  dimensions?: RoomDimensionOverrides;
  stadiumFromRow: number | null;
  /** Steps between two raised rows (each step about `STEP_HEIGHT_M`); only meaningful when `stadiumFromRow` is set. */
  stepsPerRow: number;
  aisles: {
    verticalAfterCols: number[];
    horizontalAfterRows: number[];
    /** Optional walkways running along the left and/or right walls. */
    sideAisles?: SideAisle[];
  };
  /** Rows that run continuously through a vertical aisle (e.g. back Sweetbox row). */
  aisleFills?: AisleFill[];
  entrances: { side: EntranceSide; position: EntrancePosition }[];
  overrides: SeatOverride[];
}

export interface SeatTypeInfo {
  id: string;
  name: string;
  /** 1 = single seat, 2 = couple seat (one seat spanning two cells). */
  capacity: number;
  /** 3D chair style; defaults to "standard" when omitted. */
  style?: SeatStyle;
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
  /** x of each unfilled vertical aisle's centre. */
  verticalAisles: number[];
  /** Vertical aisles bridged by selected rows (e.g. continuous back Sweetbox row), keeping open walkway on other rows. */
  partialVerticalAisles?: { x: number; gapWidth: number; filledRows: number[] }[];
  /** Walkways along the left and/or right walls. */
  sideAisles?: SideAisle[];
  /** y of each horizontal aisle's centre. */
  horizontalAisles: number[];
  entrances: { side: EntranceSide; position: EntrancePosition; x: number; y: number }[];
  /** Centre x of each physical column (from the left) and centre y of each physical row (from the screen). */
  colX: number[];
  rowY: number[];
  /** y of the first and last row centres. */
  firstRowY: number;
  lastRowY: number;
  /** Every position of each row from the left, by row label (differs from `colNumbers` on rows that cross an aisle). */
  rowSlots?: Record<string, { col: number; x: number }[]>;
  /** Labels in physical order from the screen. */
  rowLabels: string[];
  /** Column numbers in physical order from the left. */
  colNumbers: number[];
}
