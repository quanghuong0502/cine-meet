import {
  DEFAULT_CINEMA_DIMENSIONS,
  type CinemaDimensionDefaults,
  type ResolvedRoomDimensions,
} from "@/lib/seat-layout/dimensions.defaults";
import { buildPhysicalRoom, type PhysicalRoom } from "@/lib/seat-layout/physical";
import type {
  GridSeat,
  LayoutConfig,
  LayoutGeometry,
  LayoutSeat,
  RowPitch,
  ScreenDistance,
  ScreenMount,
  ScreenShape,
  SeatRecline,
} from "@/lib/seat-layout/types";

/**
 * Seat score (design 2.3): 100 minus penalties, 0 to 100. The room is turned into metres and each seat is judged the way a
 * cinema designer would: how wide the screen looks, how far the neck bends, how far off the screen's axis the seat is,
 * whether the heads in front block the view, where the sound is best, and whether a door or a broken seat spoils it.
 *
 * Physical defaults come from `DEFAULT_CINEMA_DIMENSIONS` (TCVN 5577:2012, SMPTE EG 18, THX, Neufert) and can be
 * dynamically overridden both system-wide (Admin Settings) and per-room (`config.dimensions`).
 */
export const SEAT_PITCH_M = DEFAULT_CINEMA_DIMENSIONS.seatPitchM;
export const ROW_PITCH_M = DEFAULT_CINEMA_DIMENSIONS.rowPitch.standard;
export const ROW_PITCH_BY_SPACING: Record<RowPitch, number> = DEFAULT_CINEMA_DIMENSIONS.rowPitch;
/** Reference standing height (cm) corresponding to `EYE_HEIGHT_M`. */
export const REFERENCE_HEIGHT_CM = 170;
export const EYE_HEIGHT_M = 1.1;
/** Top of a seated head above the eyes. */
export const HEAD_ABOVE_EYE_M = 0.12;
export const SCREEN_BOTTOM_M = DEFAULT_CINEMA_DIMENSIONS.screenMount.mid;
export const SCREEN_ASPECT = DEFAULT_CINEMA_DIMENSIONS.screenAspect.scope;
export const SCREEN_ASPECT_BY_SHAPE: Record<ScreenShape, number> = DEFAULT_CINEMA_DIMENSIONS.screenAspect;
export const SCREEN_BOTTOM_BY_MOUNT: Record<ScreenMount, number> = DEFAULT_CINEMA_DIMENSIONS.screenMount;
export const SCREEN_DISTANCE_RATIO: Record<ScreenDistance, { ratio: number; minM: number }> =
  DEFAULT_CINEMA_DIMENSIONS.screenDistance;
export const STEP_HEIGHT_M = DEFAULT_CINEMA_DIMENSIONS.stepHeightM;

export const SEAT_RECLINE_DEG: Record<SeatRecline, number> = { upright: 8, slight: 16, deep: 28 };
/** Comfortable upward gaze shift (degrees) when reclined: deep recline makes high-mounted screens natural to watch. */
export const RECLINE_COMFORT_DEG: Record<SeatRecline, number> = { upright: 0, slight: 4, deep: 14 };
/** Seated eye/head drop (metres) from spine tilt kinematics (`~0.69 m × (cos 8° − cos θ)`) + relaxed cinema slouch. */
export const RECLINE_EYE_DROP_M: Record<SeatRecline, number> = { upright: 0, slight: 0.03, deep: 0.08 };

export function rowPitchM(pitch?: RowPitch, defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS): number {
  return pitch ? defaults.rowPitch[pitch] : defaults.rowPitch.standard;
}

export function frontRowDistanceM(
  distance: ScreenDistance,
  screenWidthM: number,
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): number {
  const spec = defaults.screenDistance[distance];
  return Math.max(spec.minM, screenWidthM * spec.ratio);
}

/** Distance in metres from the screen (`z = 0`) to any row-unit `y` coordinate in `LayoutGeometry`. */
export function rowDistanceM(
  y: number,
  firstRowY: number,
  distance: ScreenDistance,
  screenWidthM: number,
  pitch?: RowPitch,
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): number {
  return frontRowDistanceM(distance, screenWidthM, defaults) + (y - firstRowY) * rowPitchM(pitch, defaults);
}

/** Seated eye height above the row floor from standing height (cm), anchored at 170 cm -> 1.10 m. */
export function sittingEyeHeightM(standingCm: number): number {
  return EYE_HEIGHT_M + ((standingCm - REFERENCE_HEIGHT_CM) / 100) * 0.44;
}

export function screenAspect(shape?: ScreenShape, defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS): number {
  return shape ? defaults.screenAspect[shape] : defaults.screenAspect.scope;
}

export function screenBottomM(mount?: ScreenMount, defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS): number {
  return mount ? defaults.screenMount[mount] : defaults.screenMount.mid;
}

export function seatReclineDeg(recline?: SeatRecline): number {
  return recline ? SEAT_RECLINE_DEG[recline] : 14;
}

export function reclineComfortDeg(recline?: SeatRecline): number {
  return recline ? RECLINE_COMFORT_DEG[recline] : 0;
}

export function reclineEyeDropM(recline?: SeatRecline): number {
  return recline ? RECLINE_EYE_DROP_M[recline] : 0;
}

/**
 * Ergonomic vertical viewing relief (degrees) when a high screen tilts downward toward an upward-gazing viewer.
 * Aligning the screen normal with the upward line of sight removes vertical foreshortening for reclined viewers,
 * while giving zero bonus when the viewer sits above screen centre looking downward.
 */
export function screenTiltComfortDeg(tiltDeg: number, verticalCenterDeg: number): number {
  if (tiltDeg <= 0 || verticalCenterDeg <= 0) return 0;
  return Math.min(tiltDeg, verticalCenterDeg) * 0.65;
}

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
/** Disturbance radius around an entrance/exit door, in real metres. */
export const ENTRANCE_REACH = 3.0;

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
  dims: ResolvedRoomDimensions;
  /** Shared real-metre physical room model (identical to `buildRoomScene`). */
  physical: PhysicalRoom;
  /** Seats by physical row from the screen, for "who sits in front of me". */
  rows: Map<number, GridSeat[]>;
  screenWidthM: number;
  screenHeightM: number;
  screenBottom: number;
  /** Screen horizontal centre in real metres. */
  screenCentreX: number;
}

export function buildScoreContext(
  seats: GridSeat[],
  config: LayoutConfig,
  geometry: LayoutGeometry,
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): ScoreContext {
  const rows = new Map<number, GridSeat[]>();
  for (const seat of seats) {
    const list = rows.get(seat.rowIndex);
    if (list) list.push(seat);
    else rows.set(seat.rowIndex, [seat]);
  }
  const physical = buildPhysicalRoom(
    geometry,
    {
      screenDistance: config.screen.distance,
      screenShape: config.screen.shape,
      screenMount: config.screen.mount,
      screenTilt: config.screen.tilt,
      rowPitch: config.rowPitch,
      dimensions: config.dimensions,
    },
    defaults,
  );
  return {
    config,
    geometry,
    dims: physical.dims,
    physical,
    rows,
    screenWidthM: physical.screen.width,
    screenHeightM: physical.screen.height,
    screenBottom: physical.screen.bottom,
    screenCentreX: physical.screen.centreX,
  };
}

/**
 * Floor height of a physical row (0 = front ground floor). Without a stadium section the room is flat.
 * Row 1 (A) always sits flush on the front floor (`0 m`) so `screenMount` reflects true screen elevation above row A;
 * for `stadiumFromRow = 1` every subsequent row steps up evenly, while legacy `stadiumFromRow >= 2` keeps front rows flat.
 */
export function floorHeight(
  rowIndex: number,
  config: Pick<LayoutConfig, "stadiumFromRow" | "stepsPerRow">,
  stepHeightM = STEP_HEIGHT_M,
): number {
  if (config.stadiumFromRow === null) return 0;
  const firstRaisedIndex = config.stadiumFromRow <= 1 ? 1 : config.stadiumFromRow - 1;
  return stepHeightM * config.stepsPerRow * Math.max(0, rowIndex - firstRaisedIndex + 1);
}

/** The seat directly in front (compared by physical x overlap in metres so aisle-filling rows match accurately). */
function seatInFront(seat: GridSeat, seatX: number, ctx: ScoreContext): GridSeat | undefined {
  const halfW = (seat.span * ctx.dims.seatPitchM) / 2;
  const left = seatX - halfW;
  const right = seatX + halfW;
  const margin = ctx.dims.seatPitchM * 0.1;
  return ctx.rows.get(seat.rowIndex - 1)?.find((other) => {
    const otherX = ctx.physical.toWorldX(other.x);
    const otherHalf = (other.span * ctx.dims.seatPitchM) / 2;
    return otherX - otherHalf < right - margin && otherX + otherHalf > left + margin;
  });
}

export function scoreBreakdown(seat: GridSeat, ctx: ScoreContext): SeatScoreBreakdown {
  const w = SCORE_WEIGHTS;
  const { config, dims, physical } = ctx;
  const seatX = physical.toWorldX(seat.x);
  const distance = physical.toWorldZ(seat.y);
  const offset = seatX - physical.screen.centreX;

  // Horizontal angle the screen takes up, from this very seat (off-centre seats see it a little narrower).
  const left = physical.screen.left - seatX;
  const right = physical.screen.right - seatX;
  const hAngle = (Math.atan2(right, distance) - Math.atan2(left, distance)) * DEG;
  const c = COMFORT_H_ANGLE;
  const hLoss = hAngle < c.min ? clamp01((c.min - hAngle) / (c.min - c.fullLossBelow)) : hAngle > c.max ? clamp01((hAngle - c.max) / (c.fullLossAbove - c.max)) : 0;

  // Neck: angle up from the eyes to the top edge of the screen. Reclined seats and downward-tilted high screens
  // align the viewer's resting upward gaze with the screen normal so the full frame stays comfortable.
  const eyeDrop = reclineEyeDropM(config.seatRecline);
  const eye = floorHeight(seat.rowIndex, config, dims.stepHeightM) + EYE_HEIGHT_M - eyeDrop;
  const vAngle = Math.atan2(physical.screen.topY - eye, Math.max(0.2, distance - physical.screen.topZ)) * DEG;
  const centerElev = Math.atan2(physical.screen.centerY - eye, Math.max(0.2, distance - physical.screen.centerZ)) * DEG;
  const v = COMFORT_V_ANGLE;
  const reclineBonus = reclineComfortDeg(config.seatRecline);
  const tiltBonus = screenTiltComfortDeg(physical.screen.tiltDeg, centerElev);
  const vLoss = clamp01((vAngle - (v.comfortable + reclineBonus + tiltBonus)) / (v.fullLoss - v.comfortable));

  // Off-axis: how far the line of sight is from the screen's perpendicular.
  const offAxis = Math.atan2(Math.abs(offset), distance) * DEG;
  const offLoss = clamp01((offAxis / OFF_AXIS_FULL_DEG) ** 2);

  // Sightline: does the head of the person in front cover the bottom edge of the screen? Height of my line of sight to the
  // bottom of the screen at the row in front, minus the top of that person's head. Staggered rows let you see between heads.
  let clearance: number | null = null;
  let sightLoss = 0;
  const front = seatInFront(seat, seatX, ctx);
  if (front) {
    const gap = distance - physical.toWorldZ(front.y);
    const distBottom = Math.max(0.2, distance - physical.screen.bottomZ);
    const lineAtFront = eye - (eye - ctx.screenBottom) * (gap / distBottom);
    const headTop = floorHeight(front.rowIndex, config, dims.stepHeightM) + EYE_HEIGHT_M - eyeDrop + HEAD_ABOVE_EYE_M;
    clearance = lineAtFront - headTop;
    const staggerFactor = config.seatStagger === "staggered" ? 0.35 : 1;
    sightLoss = clamp01((CLEARANCE_M.good - clearance) / (CLEARANCE_M.good - CLEARANCE_M.blocked)) * staggerFactor;
  }

  // Sound: near the room's centre line and around the reference depth, both measured in real metres.
  const halfWidth = Math.max(physical.widthM / 2, 0.5);
  const roomCentreLoss = clamp01(Math.abs(seatX - physical.widthM / 2) / halfWidth);
  const depthLoss = clamp01(Math.abs(distance / Math.max(physical.lastRowZ, 0.5) - REFERENCE_DEPTH) / 0.5);

  let entrance = 0;
  for (const e of physical.entrances) {
    const d = Math.hypot(seatX - e.x, distance - e.z);
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

export function scoreSeats(
  seats: GridSeat[],
  config: LayoutConfig,
  geometry: LayoutGeometry,
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): LayoutSeat[] {
  const ctx = buildScoreContext(seats, config, geometry, defaults);
  return seats.map((seat) => ({ ...seat, score: scoreBreakdown(seat, ctx).score }));
}
