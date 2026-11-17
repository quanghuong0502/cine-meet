import type { GridSeat, LayoutConfig, LayoutGeometry, LayoutSeat } from "@/lib/seat-layout/types";

/**
 * Seat score (design 2.3): 100 minus penalties, 0 to 100. The room is turned into metres and each seat is judged the way a
 * cinema designer would: how wide the screen looks, how far the neck bends, how far off the screen's axis the seat is,
 * whether the heads in front block the view, where the sound is best, and whether a door or a broken seat spoils it.
 *
 * Where the numbers come from:
 * - Published cinema guidance (secondary sources; the SMPTE and THX documents themselves were not read):
 *   horizontal viewing angle at least 36 degrees (THX) with about 40 ideal, 30 as SMPTE's minimum; vertical angle to the top
 *   of the screen not above 35 degrees (SMPTE EG18); rows 0.9 to 1.07 m apart; a stadium rise of roughly 12 to 18 cm per row for a shallow tier;
 *   the "reference seat" about two thirds of the way back.
 * - Everything else (weights, the screen's height and bottom edge, the 0.12 m clearance target, the shape of each ramp)
 *   is a judgement call. It all lives in the constants below so it can be tuned in one place.
 *
 * The layout gives no real dimensions, so these are assumed: a seat is 0.55 m wide, a row is 1.0 m deep, a seated eye is 1.1 m
 * above its own floor, the screen is 2:1 and starts 1.0 m above the floor of the screen wall.
 */
export const SEAT_PITCH_M = 0.55;
export const ROW_PITCH_M = 1.0;
export const EYE_HEIGHT_M = 1.1;
/** Top of a seated head above the eyes. */
export const HEAD_ABOVE_EYE_M = 0.12;
export const SCREEN_BOTTOM_M = 1.0;
export const SCREEN_ASPECT = 2.0;
/**
 * Floor rise per row from the row where the stadium section starts. Sources give roughly 12 to 18 cm for a shallow tier and note
 * that this barely clears heads; commercial rooms rise more, so 0.2 m is assumed. The layout has no field for the real rise.
 */
export const STADIUM_RISE_M = 0.2;

export const SCORE_WEIGHTS = {
  /** Loss when the screen looks far too wide (front rows) or far too small (too far back). */
  horizontalAngle: 40,
  /** Loss when the neck must bend far back to see the top of the screen. */
  verticalAngle: 25,
  /** Loss for sitting far to the side of the screen's axis (the image looks skewed). */
  offAxis: 25,
  /** Loss when the heads in front cut into the bottom of the screen. */
  sightline: 20,
  /** Loss for being off the room's centre line (surround sound balance). */
  roomCentre: 6,
  /** Loss for being away from the reference depth (sound). */
  referenceDepth: 6,
  /** Max loss right next to an entrance, fading to 0 at `entranceReach` (in layout units). */
  entrance: 8,
  broken: 50,
  obstructed: 25,
} as const;

/** Horizontal angle (degrees of the screen's width as seen from the seat): no loss inside this band. */
export const COMFORT_H_ANGLE = { min: 36, max: 46, fullLossBelow: 20, fullLossAbove: 80 } as const;
/** Vertical angle to the top of the screen: no loss up to `comfortable`, full loss at `fullLoss`. SMPTE's 35 sits in between. */
export const COMFORT_V_ANGLE = { comfortable: 30, fullLoss: 55 } as const;
/** Off-axis angle at which the full off-axis loss applies (the loss grows with its square). */
export const OFF_AXIS_FULL_DEG = 45;
/** Eye clearance over the head in front: no loss from here up, full loss at `blocked`. */
export const CLEARANCE_M = { good: 0.12, blocked: -0.15 } as const;
/** Reference seat depth as a share of the room's depth (two thirds back, "60 to 70 percent" in design 2.3). */
export const REFERENCE_DEPTH = 0.65;
export const ENTRANCE_REACH = 2.5;

const DEG = 180 / Math.PI;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** What went into one seat's score: the measurements and the points each one cost. */
export interface SeatScoreBreakdown {
  score: number;
  /** Measurements, in degrees and metres. `clearanceM` is null for a seat with nobody in front of it. */
  measures: { horizontalAngleDeg: number; verticalAngleDeg: number; offAxisDeg: number; clearanceM: number | null; distanceM: number };
  /** Points lost per cause (positive numbers), before the final rounding and 0 to 100 limit. */
  losses: {
    horizontalAngle: number;
    verticalAngle: number;
    offAxis: number;
    sightline: number;
    roomCentre: number;
    referenceDepth: number;
    entrance: number;
    flags: number;
  };
}

export interface ScoreContext {
  config: LayoutConfig;
  geometry: LayoutGeometry;
  /** Seats by physical row from the screen, for "who sits in front of me". */
  rows: Map<number, GridSeat[]>;
  screenWidthM: number;
  screenHeightM: number;
  screenCentreX: number;
}

export function buildScoreContext(seats: GridSeat[], config: LayoutConfig, geometry: LayoutGeometry): ScoreContext {
  const rows = new Map<number, GridSeat[]>();
  for (const seat of seats) {
    const list = rows.get(seat.rowIndex);
    if (list) list.push(seat);
    else rows.set(seat.rowIndex, [seat]);
  }
  const screenWidthM = (geometry.screen.x2 - geometry.screen.x1) * SEAT_PITCH_M;
  return {
    config,
    geometry,
    rows,
    screenWidthM,
    screenHeightM: screenWidthM / SCREEN_ASPECT,
    screenCentreX: (geometry.screen.x1 + geometry.screen.x2) / 2,
  };
}

/** Floor height of a physical row (0 = front). Without a stadium section the room is flat. */
export function floorHeight(rowIndex: number, config: LayoutConfig): number {
  if (config.stadiumFromRow === null) return 0;
  return STADIUM_RISE_M * Math.max(0, rowIndex + 1 - (config.stadiumFromRow - 1));
}

/** The seat directly in front (same columns, previous row), if there is one; nobody sits in a removed cell or across the gap. */
function seatInFront(seat: GridSeat, ctx: ScoreContext): GridSeat | undefined {
  const first = seat.colIndex;
  const last = seat.colIndex + seat.span - 1;
  return ctx.rows.get(seat.rowIndex - 1)?.find((other) => other.colIndex <= last && other.colIndex + other.span - 1 >= first);
}

export function scoreBreakdown(seat: GridSeat, ctx: ScoreContext): SeatScoreBreakdown {
  const w = SCORE_WEIGHTS;
  const { config, geometry } = ctx;
  const distance = seat.y * ROW_PITCH_M; // the screen is at y = 0
  const offset = (seat.x - ctx.screenCentreX) * SEAT_PITCH_M;

  // Horizontal angle the screen takes up, from this very seat (off-centre seats see it a little narrower).
  const left = (geometry.screen.x1 - seat.x) * SEAT_PITCH_M;
  const right = (geometry.screen.x2 - seat.x) * SEAT_PITCH_M;
  const hAngle = (Math.atan2(right, distance) - Math.atan2(left, distance)) * DEG;
  const c = COMFORT_H_ANGLE;
  const hLoss = hAngle < c.min ? clamp01((c.min - hAngle) / (c.min - c.fullLossBelow)) : hAngle > c.max ? clamp01((hAngle - c.max) / (c.fullLossAbove - c.max)) : 0;

  // Neck: angle up from the eyes to the top edge of the screen.
  const eye = floorHeight(seat.rowIndex, config) + EYE_HEIGHT_M;
  const screenTop = SCREEN_BOTTOM_M + ctx.screenHeightM;
  const vAngle = Math.atan2(screenTop - eye, distance) * DEG;
  const v = COMFORT_V_ANGLE;
  const vLoss = clamp01((vAngle - v.comfortable) / (v.fullLoss - v.comfortable));

  // Off-axis: how far the line of sight is from the screen's perpendicular.
  const offAxis = Math.atan2(Math.abs(offset), distance) * DEG;
  const offLoss = clamp01((offAxis / OFF_AXIS_FULL_DEG) ** 2);

  // Sightline: does the head of the person in front cover the bottom edge of the screen? Height of my line of sight to the
  // bottom of the screen at the row in front, minus the top of that person's head.
  let clearance: number | null = null;
  let sightLoss = 0;
  const front = seatInFront(seat, ctx);
  if (front) {
    const gap = (seat.y - front.y) * ROW_PITCH_M;
    const lineAtFront = eye - (eye - SCREEN_BOTTOM_M) * (gap / distance);
    const headTop = floorHeight(front.rowIndex, config) + EYE_HEIGHT_M + HEAD_ABOVE_EYE_M;
    clearance = lineAtFront - headTop;
    sightLoss = clamp01((CLEARANCE_M.good - clearance) / (CLEARANCE_M.good - CLEARANCE_M.blocked));
  }

  // Sound: near the room's centre line and around the reference depth.
  const roomCentreLoss = clamp01(Math.abs(seat.x - geometry.width / 2) / (geometry.width / 2));
  const depthLoss = clamp01(Math.abs(seat.y / geometry.lastRowY - REFERENCE_DEPTH) / 0.5);

  let entrance = 0;
  for (const e of geometry.entrances) {
    const d = Math.hypot(seat.x - e.x, seat.y - e.y);
    if (d < ENTRANCE_REACH) entrance = Math.max(entrance, w.entrance * (1 - d / ENTRANCE_REACH));
  }

  const flags = (seat.flags.includes("broken") ? w.broken : 0) + (seat.flags.includes("obstructed") ? w.obstructed : 0);
  const losses = {
    horizontalAngle: w.horizontalAngle * hLoss,
    verticalAngle: w.verticalAngle * vLoss,
    offAxis: w.offAxis * offLoss,
    sightline: w.sightline * sightLoss,
    roomCentre: w.roomCentre * roomCentreLoss,
    referenceDepth: w.referenceDepth * depthLoss,
    entrance,
    flags,
  };
  const total = Object.values(losses).reduce((sum, n) => sum + n, 0);

  return {
    score: Math.round(Math.min(100, Math.max(0, 100 - total))),
    measures: { horizontalAngleDeg: hAngle, verticalAngleDeg: vAngle, offAxisDeg: offAxis, clearanceM: clearance, distanceM: distance },
    losses,
  };
}

export function scoreSeats(seats: GridSeat[], config: LayoutConfig, geometry: LayoutGeometry): LayoutSeat[] {
  const ctx = buildScoreContext(seats, config, geometry);
  return seats.map((seat) => ({ ...seat, score: scoreBreakdown(seat, ctx).score }));
}
