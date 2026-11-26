import {
  DEFAULT_CINEMA_DIMENSIONS,
  type CinemaDimensionDefaults,
  type RoomDimensionOverrides,
} from "@/lib/seat-layout/dimensions.defaults";
import { buildPhysicalRoom } from "@/lib/seat-layout/physical";
import type {
  EntrancePosition,
  EntranceSide,
  LayoutGeometry,
  LayoutSeat,
  RowCurve,
  RowPitch,
  ScreenDistance,
  ScreenMount,
  ScreenShape,
  ScreenTilt,
  SeatRecline,
  SeatStagger,
  SeatStyle,
  SideAisle,
} from "@/lib/seat-layout/types";
import {
  floorHeight,
  reclineComfortDeg,
  reclineEyeDropM,
  REFERENCE_HEIGHT_CM,
  screenTiltComfortDeg,
  seatReclineDeg,
  sittingEyeHeightM,
} from "@/services/seat-score";

/**
 * Pure 3D room model in metres (no WebGL / three.js dependency).
 * Built directly on `buildPhysicalRoom` — the exact same coordinate model used by `src/services/seat-score.ts` —
 * so viewing angles, aisle widths, cross-aisle landings, screen geometry, and seat scores never drift apart.
 * Axes: +x right, +y up, +z away from the screen (screen centre sits at z = 0).
 */

export interface Room3DConfig {
  stadiumFromRow: number | null;
  stepsPerRow: number;
  screenDistance?: ScreenDistance;
  screenShape?: ScreenShape;
  screenMount?: ScreenMount;
  screenTilt?: ScreenTilt;
  screenCurved?: boolean;
  seatRecline?: SeatRecline;
  rowCurve?: RowCurve;
  seatStagger?: SeatStagger;
  rowPitch?: RowPitch;
  dimensions?: RoomDimensionOverrides;
  defaults?: CinemaDimensionDefaults;
}

export interface SceneSeatType {
  id: string;
  color: string | null;
  style?: SeatStyle;
}

export interface SceneSeat {
  code: string;
  row: string;
  col: number;
  rowIndex: number;
  colIndex: number;
  span: 1 | 2;
  type: string;
  style: SeatStyle;
  typeColor: string | null;
  score: number;
  /** Centre of the seat on its row floor, in metres. */
  x: number;
  floorY: number;
  z: number;
  /** Gentle Y rotation (radians) turning outer seats toward the screen when `rowCurve === "curved"`. */
  yaw: number;
  broken: boolean;
  obstructed: boolean;
}

export interface SceneEntrance {
  side: EntranceSide;
  position: EntrancePosition;
  x: number;
  floorY: number;
  z: number;
}

/** Continuous stepped floor deck from `zStart` to `zEnd` (bridging cross-aisles & rear walkway seamlessly). */
export interface SceneFloorSlab {
  zStart: number;
  zEnd: number;
  height: number;
}

/** Intermediate walkway stair step inside an open vertical or side aisle (QCVN 06 / IBC stepped aisle). */
export interface SceneAisleStep {
  x: number;
  /** Vertical centre of the step riser block (m). */
  y: number;
  z: number;
  widthM: number;
  depthM: number;
  heightM: number;
}

/** Warm LED step-nosing light strip placed on open vertical/side aisle edges (omitted on aisle-fill rows). */
export interface SceneAisleLight {
  x: number;
  y: number;
  z: number;
  widthM: number;
}

export type SeatNeighbourDir = "front" | "back" | "left" | "right";

export interface SeatViewMetrics {
  /** Horizontal distance from the eye to the screen plane (m). */
  distanceM: number;
  /** Horizontal field-of-view subtended by the screen width (degrees). */
  horizontalDeg: number;
  /** Upward angle from eye level to the top edge of the screen (degrees). */
  verticalTopDeg: number;
  /** Angle from eye level to the vertical centre of the screen (degrees; positive = looking up). */
  verticalCenterDeg: number;
  /** True when the upward neck angle exceeds comfortable SMPTE + seat-recline allowance. */
  neckStrain: boolean;
}

export interface RoomScene {
  widthM: number;
  depthM: number;
  leftMarginM: number;
  rightMarginM: number;
  rearMarginM: number;
  frontWallZ: number;
  backWallZ: number;
  shellWidthM: number;
  shellCenterX: number;
  seatPitchM: number;
  rowPitchM: number;
  maxFloorY: number;
  ceilingY: number;
  reclineDeg: number;
  eyeDropM: number;
  rowCurve: RowCurve;
  seatStagger: SeatStagger;
  seats: SceneSeat[];
  /** Physical centre z & elevation per row. */
  rowFloors: { rowIndex: number; z: number; height: number }[];
  /** Continuous tiered floor slabs bridging cross-aisles and extending to the rear wall. */
  floorSlabs: SceneFloorSlab[];
  /** Intermediate stair treads in open vertical/side walkways when `stepsPerRow >= 2`. */
  aisleSteps: SceneAisleStep[];
  /** Step-edge LED lights on open aisle rows & intermediate stair treads. */
  aisleLights: SceneAisleLight[];
  verticalAislesM: number[];
  sideAisles: SideAisle[];
  /** Unique walkway centre x positions (metres). */
  aisleLightXs: number[];
  horizontalAislesM: number[];
  entrances: SceneEntrance[];
  projectionPort: { x: number; y: number; z: number };
  /** Highest-scoring usable seat code in the room for quick "Best seat" preview jumps. */
  bestSeatCode: string | null;
  screen: {
    centreX: number;
    width: number;
    height: number;
    bottom: number;
    tiltDeg: number;
    bottomZ: number;
    topY: number;
    topZ: number;
    centerY: number;
    centerZ: number;
    curved: boolean;
    /** Forward sagitta (metres) at the screen's outer edges when curved. */
    curveDepth: number;
  };
  /** Seated eye position in metres for a viewer of `standingHeightCm` (default 170 cm). */
  eyeOf: (code: string, standingHeightCm?: number) => { x: number; y: number; z: number } | null;
  /** Live viewing angles and neck-comfort indicator from a seat at `standingHeightCm`. */
  viewMetricsOf: (code: string, standingHeightCm?: number) => SeatViewMetrics | null;
  /** Closest adjacent seat in screen-relative directions for quick hopping while seated in 3D. */
  neighbourOf: (code: string, dir: SeatNeighbourDir) => string | null;
}

/** Natural seated eye offset from the chair centre (+z is toward the backrest). */
const EYE_BACK_OFFSET_M = 0.04;
/** Maximum yaw turn (radians) for curved seating rows (~18 degrees). */
const MAX_ROW_CURVE_YAW = 0.31;
/** Default commercial vertical aisle width in metres (QCVN 06:2022/BXD & Neufert). */
export const REAL_AISLE_WIDTH_M = DEFAULT_CINEMA_DIMENSIONS.aisleWidthM;
/** Default horizontal cross-aisle landing width in metres (QCVN 06 & Neufert). */
export const REAL_HORIZONTAL_AISLE_WIDTH_M = DEFAULT_CINEMA_DIMENSIONS.horizontalAisleWidthM;

export function buildRoomScene(
  seats: LayoutSeat[],
  geometry: LayoutGeometry,
  config: Room3DConfig,
  seatTypes: SceneSeatType[] = [],
): RoomScene {
  const phys = buildPhysicalRoom(
    geometry,
    {
      screenDistance: config.screenDistance,
      screenShape: config.screenShape,
      screenMount: config.screenMount,
      screenTilt: config.screenTilt,
      rowPitch: config.rowPitch,
      dimensions: config.dimensions,
    },
    config.defaults ?? DEFAULT_CINEMA_DIMENSIONS,
  );
  const { seatPitchM, rowPitchM: pitchM, stepHeightM } = phys.dims;
  const { widthM, depthM, leftMarginM, rightMarginM, rearMarginM, frontWallZ, backWallZ, shellWidthM, shellCenterX } =
    phys;
  const {
    width: screenWidth,
    height: screenHeight,
    bottom: screenBottom,
    centreX: screenCentreX,
    tiltDeg: screenTiltDeg,
    bottomZ: screenBottomZ,
    topY: screenTopY,
    topZ: screenTopZ,
    centerY: screenCenterY,
    centerZ: screenCenterZ,
  } = phys.screen;

  const screenCurved = Boolean(config.screenCurved);
  const screenCurveDepth = screenCurved ? Math.min(1.1, screenWidth * 0.07) : 0;

  const rowCurve: RowCurve = config.rowCurve ?? "straight";
  const seatStagger: SeatStagger = config.seatStagger ?? "aligned";
  const curveAmp = rowCurve === "curved" ? Math.min(0.65, widthM * 0.045) : 0;
  const halfWidth = Math.max(widthM / 2, 0.5);

  const typeById = new Map(seatTypes.map((t) => [t.id, t]));

  const sceneSeats: SceneSeat[] = seats.map((seat) => {
    const staggerX = seatStagger === "staggered" ? (seat.rowIndex % 2 === 0 ? -0.25 : 0.25) * seatPitchM : 0;
    const x = phys.toWorldX(seat.x) + staggerX;
    const baseZ = phys.toWorldZ(seat.y);
    const dx = x - screenCentreX;
    const norm = Math.min(1, Math.abs(dx) / halfWidth);
    const z = baseZ - curveAmp * norm * norm;
    const yaw =
      rowCurve === "curved"
        ? Math.max(-MAX_ROW_CURVE_YAW, Math.min(MAX_ROW_CURVE_YAW, Math.atan2(-dx, Math.max(z, 2)) * 0.55))
        : 0;
    const typeInfo = typeById.get(seat.type);
    return {
      code: seat.code,
      row: seat.row,
      col: seat.col,
      rowIndex: seat.rowIndex,
      colIndex: seat.colIndex,
      span: seat.span,
      type: seat.type,
      style: typeInfo?.style ?? "standard",
      typeColor: typeInfo?.color ?? null,
      score: seat.score,
      x,
      floorY: floorHeight(seat.rowIndex, config, stepHeightM),
      z,
      yaw,
      broken: seat.flags.includes("broken"),
      obstructed: seat.flags.includes("obstructed"),
    };
  });

  const rowFloors = phys.rowZ.map((z, rowIndex) => ({
    rowIndex,
    z,
    height: floorHeight(rowIndex, config, stepHeightM),
  }));
  const maxFloorY = rowFloors.reduce((max, r) => Math.max(max, r.height), 0);
  // TCVN 5577:2012: minimum 3.0 m clear headroom above the last row floor + clearance over the screen top.
  const ceilingY = Math.max(maxFloorY + 3.0, screenBottom + screenHeight + 1.0);

  // Continuous tiered floor slabs: each row extends flush to the next row's riser (bridging horizontal cross-aisles)
  // and the final row extends all the way to the rear wall so back exits open onto a solid rear walkway.
  const floorSlabs: SceneFloorSlab[] = rowFloors.map((row, i) => ({
    zStart: row.z - pitchM / 2,
    zEnd: i < rowFloors.length - 1 ? rowFloors[i + 1].z - pitchM / 2 : backWallZ,
    height: row.height,
  }));

  // Real intermediate stair treads & step-edge LED lights inside every open vertical/side walkway segment.
  const aisleSteps: SceneAisleStep[] = [];
  const aisleLights: SceneAisleLight[] = [];
  for (const w of phys.walkways) {
    const filled = new Set(w.filledRows);
    const stepW = Math.max(0.4, w.widthM - 0.08);
    const lightW = Math.min(w.widthM * 0.52, 0.52);
    for (let i = 0; i < rowFloors.length; i++) {
      if (filled.has(i)) continue;
      const row = rowFloors[i];
      const zFront = row.z - pitchM / 2;
      const prevH = i > 0 ? rowFloors[i - 1].height : 0;
      const dh = row.height - prevH;

      aisleLights.push({
        x: w.x,
        y: Math.max(row.height, 0.015),
        z: zFront + 0.02,
        widthM: lightW,
      });

      // Subdivide multi-step rises (30–60 cm) into real ~15 cm risers with QCVN 06 treads (>= 25 cm).
      const prevRowOpen = i === 0 || !filled.has(i - 1);
      if (dh > stepHeightM * 1.15 && prevRowOpen) {
        const stepCount = Math.max(2, Math.round(dh / stepHeightM));
        const singleRise = dh / stepCount;
        const availRun = i === 0 ? Math.max(0.6, zFront - 0.5) : zFront - (rowFloors[i - 1].z - pitchM / 2);
        const tread = Math.min(0.28, (availRun * 0.72) / stepCount);
        for (let k = 1; k < stepCount; k++) {
          const topY = prevH + k * singleRise;
          const stepH = topY - prevH;
          const zStepStart = zFront - (stepCount - k) * tread;
          const zStepEnd = zFront - (stepCount - k - 1) * tread;
          aisleSteps.push({
            x: w.x,
            y: prevH + stepH / 2,
            z: (zStepStart + zStepEnd) / 2,
            widthM: stepW,
            depthM: tread + 0.01,
            heightM: stepH,
          });
          aisleLights.push({
            x: w.x,
            y: topY,
            z: zStepStart + 0.02,
            widthM: lightW * 0.88,
          });
        }
      }
    }
  }

  const lastRowIndex = Math.max(0, rowFloors.length - 1);
  const entrances: SceneEntrance[] = phys.entrances.map((e) => ({
    side: e.side,
    position: e.position,
    x: e.x,
    floorY: e.position === "front" ? 0 : floorHeight(lastRowIndex, config, stepHeightM),
    z: e.z,
  }));

  // Rear projection port aligned with screen centre, clearing standing patrons on the last row (>= 2.1 m, TCVN 5577 >= 1.9 m).
  const projectionPort = {
    x: screenCentreX,
    y: Math.max(maxFloorY + 2.25, Math.min(ceilingY - 0.65, screenCenterY + screenHeight * 0.05)),
    z: backWallZ,
  };

  const aisleLightXs = phys.walkways.map((w) => w.x);

  const usableSeats = sceneSeats.filter((s) => !s.broken && !s.obstructed);
  const candidatePool = usableSeats.length > 0 ? usableSeats : sceneSeats.filter((s) => !s.broken);
  let bestSeat: SceneSeat | null = null;
  for (const s of candidatePool) {
    if (!bestSeat || s.score > bestSeat.score) bestSeat = s;
  }
  const bestSeatCode = bestSeat?.code ?? null;

  const byCode = new Map(sceneSeats.map((s) => [s.code, s]));
  const byRow = new Map<number, SceneSeat[]>();
  for (const s of sceneSeats) {
    const list = byRow.get(s.rowIndex);
    if (list) list.push(s);
    else byRow.set(s.rowIndex, [s]);
  }
  for (const list of byRow.values()) list.sort((a, b) => a.x - b.x);
  const sortedRows = [...byRow.keys()].sort((a, b) => a - b);

  const eyeDropM = reclineEyeDropM(config.seatRecline);
  const neckComfortLimitDeg = 35 + reclineComfortDeg(config.seatRecline);
  const eyeOf = (code: string, standingHeightCm = REFERENCE_HEIGHT_CM) => {
    const seat = byCode.get(code);
    if (!seat) return null;
    return {
      x: seat.x + Math.sin(seat.yaw) * EYE_BACK_OFFSET_M,
      y: seat.floorY + sittingEyeHeightM(standingHeightCm) - eyeDropM,
      z: seat.z + Math.cos(seat.yaw) * EYE_BACK_OFFSET_M,
    };
  };

  return {
    widthM,
    depthM,
    leftMarginM,
    rightMarginM,
    rearMarginM,
    frontWallZ,
    backWallZ,
    shellWidthM,
    shellCenterX,
    seatPitchM,
    rowPitchM: pitchM,
    maxFloorY,
    ceilingY,
    reclineDeg: seatReclineDeg(config.seatRecline),
    eyeDropM,
    rowCurve,
    seatStagger,
    seats: sceneSeats,
    rowFloors,
    floorSlabs,
    aisleSteps,
    aisleLights,
    verticalAislesM: phys.verticalAislesM,
    sideAisles: phys.sideAisles,
    aisleLightXs,
    horizontalAislesM: phys.horizontalAislesM,
    entrances,
    projectionPort,
    bestSeatCode,
    screen: {
      centreX: screenCentreX,
      width: screenWidth,
      height: screenHeight,
      bottom: screenBottom,
      tiltDeg: screenTiltDeg,
      bottomZ: screenBottomZ,
      topY: screenTopY,
      topZ: screenTopZ,
      centerY: screenCenterY,
      centerZ: screenCenterZ,
      curved: screenCurved,
      curveDepth: screenCurveDepth,
    },
    eyeOf,
    viewMetricsOf: (code, standingHeightCm = REFERENCE_HEIGHT_CM) => {
      const eye = eyeOf(code, standingHeightCm);
      if (!eye || eye.z <= 0.01) return null;
      const deg = 180 / Math.PI;
      const left = screenCentreX - screenWidth / 2 - eye.x;
      const right = screenCentreX + screenWidth / 2 - eye.x;
      const horizontalDeg = (Math.atan2(right, eye.z) - Math.atan2(left, eye.z)) * deg;
      const verticalTopDeg = Math.atan2(screenTopY - eye.y, Math.max(0.2, eye.z - screenTopZ)) * deg;
      const verticalCenterDeg = Math.atan2(screenCenterY - eye.y, Math.max(0.2, eye.z - screenCenterZ)) * deg;
      const tiltBonus = screenTiltComfortDeg(screenTiltDeg, verticalCenterDeg);
      return {
        distanceM: eye.z,
        horizontalDeg,
        verticalTopDeg,
        verticalCenterDeg,
        neckStrain: verticalTopDeg > neckComfortLimitDeg + tiltBonus,
      };
    },
    neighbourOf: (code, dir) => {
      const seat = byCode.get(code);
      if (!seat) return null;
      if (dir === "left" || dir === "right") {
        const list = byRow.get(seat.rowIndex);
        if (!list) return null;
        const idx = list.findIndex((s) => s.code === code);
        if (idx < 0) return null;
        const next = list[dir === "left" ? idx - 1 : idx + 1];
        return next ? next.code : null;
      }
      const pos = sortedRows.indexOf(seat.rowIndex);
      if (pos < 0) return null;
      const targetRow = sortedRows[dir === "front" ? pos - 1 : pos + 1];
      if (targetRow === undefined) return null;
      const list = byRow.get(targetRow);
      if (!list?.length) return null;
      let best = list[0];
      let bestDist = Math.abs(best.x - seat.x);
      for (let i = 1; i < list.length; i++) {
        const d = Math.abs(list[i].x - seat.x);
        if (d < bestDist) {
          best = list[i];
          bestDist = d;
        }
      }
      return best.code;
    },
  };
}
