import {
  DEFAULT_CINEMA_DIMENSIONS,
  resolveRoomDimensions,
  type CinemaDimensionDefaults,
  type ResolvedRoomDimensions,
  type RoomDimensionSelector,
} from "./dimensions.defaults";
import { AISLE_SIZE } from "./generate";
import type { EntrancePosition, EntranceSide, LayoutGeometry, ScreenTilt, SideAisle } from "./types";

/**
 * Downward screen tilt angles (degrees, top edge tilted forward toward the audience):
 * - `flat` (0°): standard vertical cinema screen.
 * - `slight` (5°): Harkness/UNIC mild tilt for elevated screens & gentle recliners.
 * - `tilted` (10°): pronounced downward tilt for high-mounted VIP recliner / bed rooms (within DCI lens-shift limits).
 */
export const SCREEN_TILT_DEG: Record<ScreenTilt, number> = { flat: 0, slight: 5, tilted: 10 };

export function screenTiltDeg(tilt?: ScreenTilt): number {
  return tilt ? SCREEN_TILT_DEG[tilt] : 0;
}

/**
 * Single physical coordinate model (metres) shared by BOTH seat scoring (`seat-score.ts`) and the 3D scene (`scene.ts`).
 *
 * Converts the compact 2D SVG layout grid (`LayoutGeometry`) into exact architectural cinema dimensions derived from
 * TCVN 5577:2012, QCVN 06:2022/BXD, Neufert Architects' Data, IBC, SMPTE EG 18, and THX:
 * - Vertical & side aisles widen from compact 2D `AISLE_SIZE` (0.8 units) to real egress width (`aisleWidthM`, default 1.20 m).
 * - Partially-filled vertical aisles keep at least `aisleWidthM` on open rows while centring filled seats evenly inside.
 * - Horizontal cross-aisles expand to dedicated real landing slabs (`horizontalAisleWidthM`, default 1.20 m slab / ~1.40 m clear).
 * - Side acoustic wall clearances & rear circulation walkways derive from actual aisle and exit configurations.
 */

export interface PhysicalWalkway {
  /** Centre x coordinate in metres. */
  x: number;
  /** Physical walkway width in metres. */
  widthM: number;
  /** Physical row indices (0-based from screen) that place seats across this walkway (empty for normal aisles). */
  filledRows: number[];
  kind: "side-left" | "side-right" | "internal" | "implicit";
}

export interface PhysicalEntrance {
  side: EntranceSide;
  position: EntrancePosition;
  /** Wall-mounted x coordinate in metres. */
  x: number;
  /** Along-room z coordinate in metres. */
  z: number;
}

export interface PhysicalRoom {
  dims: ResolvedRoomDimensions;
  /** Width of the seating + configured-aisles envelope `[0 .. widthM]` in metres. */
  widthM: number;
  /** z coordinate of the front row centre (metres from screen plane z = 0). */
  firstRowZ: number;
  /** z coordinate of the last row centre (metres). */
  lastRowZ: number;
  /** Rear edge of the last row's seating deck (`lastRowZ + rowPitchM / 2`), in metres. */
  depthM: number;
  /** Left acoustic wall / implicit walkway clearance outside `x = 0` (metres). */
  leftMarginM: number;
  /** Right acoustic wall / implicit walkway clearance outside `x = widthM` (metres). */
  rightMarginM: number;
  /** Clearance behind the last row deck (`depthM` to `backWallZ`), in metres. */
  rearMarginM: number;
  /** z coordinate of the front acoustic baffle wall behind the screen masking (metres). */
  frontWallZ: number;
  /** z coordinate of the rear wall (metres). */
  backWallZ: number;
  /** Total structural interior width between left and right acoustic walls (metres). */
  shellWidthM: number;
  /** Horizontal centre of the structural room enclosure (metres). */
  shellCenterX: number;
  /** Physical centre z of each row (index = physical rowIndex from screen). */
  rowZ: number[];
  /** Physical centre x of each unfilled internal vertical aisle (metres). */
  verticalAislesM: number[];
  /** Physical centre z of each horizontal cross-aisle (metres). */
  horizontalAislesM: number[];
  /** All vertical/side walkways used for aisle stairs and LED step-edge lighting. */
  walkways: PhysicalWalkway[];
  sideAisles: SideAisle[];
  entrances: PhysicalEntrance[];
  screen: {
    left: number;
    right: number;
    centreX: number;
    width: number;
    height: number;
    bottom: number;
    /** Downward tilt angle in degrees (top edge tilted forward toward the audience). */
    tiltDeg: number;
    /** z coordinate of the screen's bottom edge (metres; slightly negative when tilted around centre z = 0). */
    bottomZ: number;
    /** y coordinate of the screen's top edge after tilting (metres). */
    topY: number;
    /** z coordinate of the screen's top edge after tilting (metres; positive = overhanging toward seats). */
    topZ: number;
    /** y coordinate of the screen's optical vertical centre (metres). */
    centerY: number;
    /** z coordinate of the screen's optical centre (anchored at 0 so screenDistance stays exact). */
    centerZ: number;
  };
  /** Piecewise-linear map from 2D layout X units to physical metres. */
  toWorldX: (xUnits: number) => number;
  /** Piecewise-linear map from 2D layout Y units to physical metres. */
  toWorldZ: (yUnits: number) => number;
}

interface GapSpan {
  start: number;
  end: number;
  extraM: number;
}

/** Acoustic panel clearance beside a wall that already has an explicit side-wall aisle inside `[0 .. widthM]`. */
const ACOUSTIC_WALL_AISLE_SIDE_M = 0.25;
/** Acoustic wall + armrest clearance when seats sit directly beside a closed side wall (1-sided aisle room). */
const ACOUSTIC_WALL_CLOSED_SIDE_M = 0.35;
/** Lateral acoustic baffle clearance when egress uses internal vertical aisles (Neufert / Dolby ~1.5 ft). */
const ACOUSTIC_WALL_INTERNAL_AISLE_M = 0.45;
/** Acoustic clearance behind the last row when there is no rear entrance (Neufert 450–500 mm). */
const REAR_WALL_NO_EXIT_M = 0.55;
/** Front acoustic baffle wall behind the screen plane (`z = 0`). */
const FRONT_BAFFLE_WALL_Z = -0.2;

function buildPiecewiseMapper(gaps: GapSpan[], unitScale: number, originUnits = 0, originM = 0) {
  const sorted = [...gaps].sort((a, b) => a.start - b.start);
  return (units: number): number => {
    let shift = 0;
    for (const gap of sorted) {
      if (units >= gap.end) {
        shift += gap.extraM;
      } else if (units > gap.start && gap.end > gap.start) {
        shift += ((units - gap.start) / (gap.end - gap.start)) * gap.extraM;
      }
    }
    return originM + (units - originUnits) * unitScale + shift;
  };
}

export function buildPhysicalRoom(
  geometry: LayoutGeometry,
  selector: RoomDimensionSelector,
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): PhysicalRoom {
  const dims = resolveRoomDimensions(selector, defaults);
  const { seatPitchM, rowPitchM, aisleWidthM, horizontalAisleWidthM } = dims;

  const sideAisles: SideAisle[] = geometry.sideAisles ?? [];
  const hasLeftSide = sideAisles.includes("left");
  const hasRightSide = sideAisles.includes("right");
  const sortedVerticals = [...geometry.verticalAisles].sort((a, b) => a - b);
  const partialVerticals = [...(geometry.partialVerticalAisles ?? [])].sort((a, b) => a.x - b.x);

  // Collect every X-axis aisle gap and its physical metre delta relative to compact 2D layout units.
  const xGaps: GapSpan[] = [];
  if (hasLeftSide) {
    xGaps.push({ start: 0, end: AISLE_SIZE, extraM: aisleWidthM - AISLE_SIZE * seatPitchM });
  }
  for (const ax of sortedVerticals) {
    xGaps.push({
      start: ax - AISLE_SIZE / 2,
      end: ax + AISLE_SIZE / 2,
      extraM: aisleWidthM - AISLE_SIZE * seatPitchM,
    });
  }
  for (const p of partialVerticals) {
    const realWidth = Math.max(aisleWidthM, p.gapWidth * seatPitchM);
    xGaps.push({
      start: p.x - p.gapWidth / 2,
      end: p.x + p.gapWidth / 2,
      extraM: realWidth - p.gapWidth * seatPitchM,
    });
  }
  if (hasRightSide) {
    xGaps.push({
      start: geometry.width - AISLE_SIZE,
      end: geometry.width,
      extraM: aisleWidthM - AISLE_SIZE * seatPitchM,
    });
  }

  const toWorldX = buildPiecewiseMapper(xGaps, seatPitchM);
  const widthM = toWorldX(geometry.width);

  // Screen keeps its exact widthPct and positionPct across the full physical room width.
  const widthRatio = geometry.width > 0 ? (geometry.screen.x2 - geometry.screen.x1) / geometry.width : 0.85;
  const centreRatio = geometry.width > 0 ? ((geometry.screen.x1 + geometry.screen.x2) / 2) / geometry.width : 0.5;
  const screenWidth = widthRatio * widthM;
  const screenHeight = screenWidth / dims.screenAspect;
  const screenBottom = dims.screenBottomM;
  const screenCentreX = centreRatio * widthM;
  const tiltDeg = screenTiltDeg(selector.screenTilt);
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  // Keep bottom clearance exact (`screenBottom`) and optical centre at `z = 0` (bottom recesses slightly into the baffle cavity).
  const screenBottomZ = tiltDeg === 0 ? 0 : -(screenHeight / 2) * sinT;
  const screenTopY = screenBottom + screenHeight * cosT;
  const screenTopZ = tiltDeg === 0 ? 0 : (screenHeight / 2) * sinT;
  const screenCenterY = screenBottom + (screenHeight / 2) * cosT;
  const screenCenterZ = 0;

  // Z-axis: first row starts at real screen-to-front-row distance; horizontal cross-aisles expand to real landing depth.
  const frontDistM = dims.frontRowDistanceM(screenWidth);
  const sortedHorizontals = [...geometry.horizontalAisles].sort((a, b) => a - b);
  const zGaps: GapSpan[] = sortedHorizontals.map((hy) => ({
    start: hy - AISLE_SIZE / 2,
    end: hy + AISLE_SIZE / 2,
    extraM: horizontalAisleWidthM - AISLE_SIZE * rowPitchM,
  }));
  const toWorldZ = buildPiecewiseMapper(zGaps, rowPitchM, geometry.firstRowY, frontDistM);

  const rowZ = geometry.rowY.map((y) => toWorldZ(y));
  const firstRowZ = toWorldZ(geometry.firstRowY);
  const lastRowZ = toWorldZ(geometry.lastRowY);
  const depthM = lastRowZ + rowPitchM / 2;

  // Architectural margins around the seating envelope derived from real egress & acoustic treatment needs.
  const hasExplicitSide = sideAisles.length > 0;
  const hasInternalVertical = sortedVerticals.length > 0 || partialVerticals.length > 0;
  let leftMarginM: number;
  let rightMarginM: number;
  if (hasExplicitSide) {
    leftMarginM = hasLeftSide ? ACOUSTIC_WALL_AISLE_SIDE_M : ACOUSTIC_WALL_CLOSED_SIDE_M;
    rightMarginM = hasRightSide ? ACOUSTIC_WALL_AISLE_SIDE_M : ACOUSTIC_WALL_CLOSED_SIDE_M;
  } else if (hasInternalVertical) {
    leftMarginM = ACOUSTIC_WALL_INTERNAL_AISLE_M;
    rightMarginM = ACOUSTIC_WALL_INTERNAL_AISLE_M;
  } else {
    // Simple layout with no aisles configured: reserve outer circulation aisles along both walls.
    leftMarginM = aisleWidthM + 0.15;
    rightMarginM = aisleWidthM + 0.15;
  }

  const hasBackEntrance = geometry.entrances.some((e) => e.position === "back");
  const rearMarginM = hasBackEntrance ? Math.max(aisleWidthM, 1.2) : REAR_WALL_NO_EXIT_M;
  const frontWallZ = Math.min(FRONT_BAFFLE_WALL_Z, screenBottomZ - 0.2);
  const backWallZ = depthM + rearMarginM;
  const shellWidthM = widthM + leftMarginM + rightMarginM;
  const shellCenterX = (widthM + rightMarginM - leftMarginM) / 2;

  const verticalAislesM = sortedVerticals.map((ax) => toWorldX(ax));
  const horizontalAislesM = sortedHorizontals.map((hy) => toWorldZ(hy));

  const walkways: PhysicalWalkway[] = [];
  if (hasLeftSide) {
    walkways.push({ x: aisleWidthM / 2, widthM: aisleWidthM, filledRows: [], kind: "side-left" });
  }
  for (const ax of sortedVerticals) {
    walkways.push({ x: toWorldX(ax), widthM: aisleWidthM, filledRows: [], kind: "internal" });
  }
  for (const p of partialVerticals) {
    walkways.push({
      x: toWorldX(p.x),
      widthM: Math.max(aisleWidthM, p.gapWidth * seatPitchM),
      filledRows: p.filledRows,
      kind: "internal",
    });
  }
  if (hasRightSide) {
    walkways.push({ x: widthM - aisleWidthM / 2, widthM: aisleWidthM, filledRows: [], kind: "side-right" });
  }
  if (walkways.length === 0) {
    walkways.push(
      { x: -aisleWidthM / 2, widthM: aisleWidthM, filledRows: [], kind: "implicit" },
      { x: widthM + aisleWidthM / 2, widthM: aisleWidthM, filledRows: [], kind: "implicit" },
    );
  }
  walkways.sort((a, b) => a.x - b.x);

  const entrances: PhysicalEntrance[] = geometry.entrances.map((e) => ({
    side: e.side,
    position: e.position,
    x: e.side === "left" ? -leftMarginM : e.side === "right" ? widthM + rightMarginM : shellCenterX,
    z:
      e.side === "center"
        ? e.position === "back"
          ? backWallZ
          : frontWallZ
        : e.position === "front"
          ? firstRowZ
          : lastRowZ,
  }));

  return {
    dims,
    widthM,
    firstRowZ,
    lastRowZ,
    depthM,
    leftMarginM,
    rightMarginM,
    rearMarginM,
    frontWallZ,
    backWallZ,
    shellWidthM,
    shellCenterX,
    rowZ,
    verticalAislesM,
    horizontalAislesM,
    walkways,
    sideAisles,
    entrances,
    screen: {
      left: screenCentreX - screenWidth / 2,
      right: screenCentreX + screenWidth / 2,
      centreX: screenCentreX,
      width: screenWidth,
      height: screenHeight,
      bottom: screenBottom,
      tiltDeg,
      bottomZ: screenBottomZ,
      topY: screenTopY,
      topZ: screenTopZ,
      centerY: screenCenterY,
      centerZ: screenCenterZ,
    },
    toWorldX,
    toWorldZ,
  };
}
