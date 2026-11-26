import { z } from "zod";
import { DEFAULT_CINEMA_DIMENSIONS, DIMENSION_BOUNDS } from "./dimensions.defaults";

export {
  cleanDimensionOverrides,
  DEFAULT_CINEMA_DIMENSIONS,
  DIMENSION_BOUNDS,
  resolveRoomDimensions,
  type CinemaDimensionDefaults,
  type ResolvedRoomDimensions,
  type RoomDimensionOverrides,
  type RoomDimensionSelector,
} from "./dimensions.defaults";

const numIn = (b: { min: number; max: number }) => z.number().finite().min(b.min).max(b.max);

export const roomDimensionOverridesSchema = z
  .object({
    seatPitchM: numIn(DIMENSION_BOUNDS.seatPitchM).optional(),
    rowPitchM: numIn(DIMENSION_BOUNDS.rowPitchM).optional(),
    stepHeightM: numIn(DIMENSION_BOUNDS.stepHeightM).optional(),
    aisleWidthM: numIn(DIMENSION_BOUNDS.aisleWidthM).optional(),
    horizontalAisleWidthM: numIn(DIMENSION_BOUNDS.horizontalAisleWidthM).optional(),
    screenDistanceM: numIn(DIMENSION_BOUNDS.screenDistanceM).optional(),
    screenBottomM: numIn(DIMENSION_BOUNDS.screenBottomM).optional(),
    screenAspect: numIn(DIMENSION_BOUNDS.screenAspect).optional(),
  })
  .optional();

const distanceSpecSchema = z.object({
  ratio: numIn(DIMENSION_BOUNDS.screenDistanceRatio),
  minM: numIn(DIMENSION_BOUNDS.screenDistanceM),
});

export const cinemaDimensionDefaultsSchema = z.object({
  seatPitchM: numIn(DIMENSION_BOUNDS.seatPitchM),
  stepHeightM: numIn(DIMENSION_BOUNDS.stepHeightM),
  aisleWidthM: numIn(DIMENSION_BOUNDS.aisleWidthM),
  horizontalAisleWidthM: numIn(DIMENSION_BOUNDS.horizontalAisleWidthM).default(
    DEFAULT_CINEMA_DIMENSIONS.horizontalAisleWidthM,
  ),
  rowPitch: z.object({
    tight: numIn(DIMENSION_BOUNDS.rowPitchM),
    standard: numIn(DIMENSION_BOUNDS.rowPitchM),
    vip: numIn(DIMENSION_BOUNDS.rowPitchM),
    bed: numIn(DIMENSION_BOUNDS.rowPitchM),
  }),
  screenMount: z.object({
    low: numIn(DIMENSION_BOUNDS.screenBottomM),
    mid: numIn(DIMENSION_BOUNDS.screenBottomM),
    high: numIn(DIMENSION_BOUNDS.screenBottomM),
  }),
  screenAspect: z.object({
    scope: numIn(DIMENSION_BOUNDS.screenAspect),
    standard: numIn(DIMENSION_BOUNDS.screenAspect),
    square: numIn(DIMENSION_BOUNDS.screenAspect),
  }),
  screenDistance: z.object({
    near: distanceSpecSchema,
    medium: distanceSpecSchema,
    far: distanceSpecSchema,
  }),
});
