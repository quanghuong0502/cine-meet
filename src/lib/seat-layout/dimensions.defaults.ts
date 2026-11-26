import type { RowPitch, ScreenDistance, ScreenMount, ScreenShape, ScreenTilt } from "./types";

/**
 * Physical cinema dimensions (in metres & aspect ratios), shared by seat scoring and 3D scene building.
 * Pure constants and helpers with zero `zod` dependency so client components (2D/3D seat views, forms) never pull Zod.
 */

export interface CinemaDimensionDefaults {
  /** Seat width centre-to-centre (m). Standard: 0.55 m (Ferco / Figueras / Neufert). */
  seatPitchM: number;
  /** Height of one stair step between rows (m). Standard: 0.15 m (QCVN 06 / IBC / Neufert). */
  stepHeightM: number;
  /** Clear vertical & side aisle width (m). Standard: 1.20 m (QCVN 06:2022/BXD >= 1.2 m for >50 seats, Neufert / IBC). */
  aisleWidthM: number;
  /** Dedicated horizontal cross-aisle slab depth between row decks (m). Standard: 1.20 m (~1.40 m clear walkway, Neufert / IBC). */
  horizontalAisleWidthM: number;
  /** Row-to-row pitch (m) per spacing tier. */
  rowPitch: Record<RowPitch, number>;
  /** Screen bottom height above front floor (m) per mount preset (SMPTE EG 18). */
  screenMount: Record<ScreenMount, number>;
  /** Screen aspect ratio (width / height) per format preset. */
  screenAspect: Record<ScreenShape, number>;
  /** Screen-to-front-row distance multiplier (× screen width) and minimum distance (m). */
  screenDistance: Record<ScreenDistance, { ratio: number; minM: number }>;
}

export interface RoomDimensionOverrides {
  seatPitchM?: number;
  rowPitchM?: number;
  stepHeightM?: number;
  aisleWidthM?: number;
  horizontalAisleWidthM?: number;
  screenDistanceM?: number;
  screenBottomM?: number;
  screenAspect?: number;
}

export const DEFAULT_CINEMA_DIMENSIONS: CinemaDimensionDefaults = {
  seatPitchM: 0.55,
  stepHeightM: 0.15,
  aisleWidthM: 1.2,
  horizontalAisleWidthM: 1.2,
  rowPitch: {
    tight: 0.95,
    standard: 1.1,
    vip: 1.45,
    bed: 1.7,
  },
  screenMount: {
    low: 1.2,
    mid: 1.7,
    high: 2.25,
  },
  screenAspect: {
    scope: 2.39,
    standard: 1.85,
    square: 1.43,
  },
  screenDistance: {
    near: { ratio: 0.5, minM: 2.5 },
    medium: { ratio: 0.68, minM: 3.8 },
    far: { ratio: 0.88, minM: 5.2 },
  },
};

export const DIMENSION_BOUNDS = {
  seatPitchM: { min: 0.4, max: 1.2 },
  rowPitchM: { min: 0.75, max: 2.5 },
  stepHeightM: { min: 0.05, max: 0.4 },
  aisleWidthM: { min: 0.5, max: 3.0 },
  horizontalAisleWidthM: { min: 0.6, max: 3.5 },
  screenDistanceM: { min: 1.0, max: 20.0 },
  screenDistanceRatio: { min: 0.25, max: 2.0 },
  screenBottomM: { min: 0.2, max: 4.0 },
  screenAspect: { min: 1.1, max: 3.5 },
} as const;

export interface ResolvedRoomDimensions {
  seatPitchM: number;
  rowPitchM: number;
  stepHeightM: number;
  aisleWidthM: number;
  horizontalAisleWidthM: number;
  screenBottomM: number;
  screenAspect: number;
  frontRowDistanceM: (screenWidthM: number) => number;
}

export interface RoomDimensionSelector {
  screenDistance?: ScreenDistance;
  screenShape?: ScreenShape;
  screenMount?: ScreenMount;
  screenTilt?: ScreenTilt;
  rowPitch?: RowPitch;
  dimensions?: RoomDimensionOverrides;
}

/** Merges system defaults, room preset chips, and optional per-room numeric overrides into concrete metres. */
export function resolveRoomDimensions(
  selector: RoomDimensionSelector,
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): ResolvedRoomDimensions {
  const o = selector.dimensions;
  const distSpec = defaults.screenDistance[selector.screenDistance ?? "medium"];
  return {
    seatPitchM: o?.seatPitchM ?? defaults.seatPitchM,
    rowPitchM: o?.rowPitchM ?? defaults.rowPitch[selector.rowPitch ?? "standard"],
    stepHeightM: o?.stepHeightM ?? defaults.stepHeightM,
    aisleWidthM: o?.aisleWidthM ?? defaults.aisleWidthM,
    horizontalAisleWidthM:
      o?.horizontalAisleWidthM ??
      defaults.horizontalAisleWidthM ??
      DEFAULT_CINEMA_DIMENSIONS.horizontalAisleWidthM,
    screenBottomM: o?.screenBottomM ?? defaults.screenMount[selector.screenMount ?? "mid"],
    screenAspect: o?.screenAspect ?? defaults.screenAspect[selector.screenShape ?? "scope"],
    frontRowDistanceM: (screenWidthM) =>
      o?.screenDistanceM !== undefined ? o.screenDistanceM : Math.max(distSpec.minM, screenWidthM * distSpec.ratio),
  };
}

/** Removes undefined/empty entries; returns undefined when no override is active so saved configs stay tidy. */
export function cleanDimensionOverrides(overrides?: RoomDimensionOverrides): RoomDimensionOverrides | undefined {
  if (!overrides) return undefined;
  const out: RoomDimensionOverrides = {};
  for (const key of Object.keys(overrides) as (keyof RoomDimensionOverrides)[]) {
    const v = overrides[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
