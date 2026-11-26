import { DEFAULT_CINEMA_DIMENSIONS, type CinemaDimensionDefaults } from "@/lib/seat-layout/dimensions.defaults";
import { generateGrid } from "@/lib/seat-layout/generate";
import { buildLayoutSummary } from "@/lib/seat-layout/summary";
import type { LayoutConfig, LayoutGeometry, LayoutSeat, SeatTypeInfo } from "@/lib/seat-layout/types";
import { scoreSeats } from "./seat-score";

export interface BuiltLayoutPreview {
  seats: LayoutSeat[];
  geometry: LayoutGeometry;
}

export interface BuiltLayout extends BuiltLayoutPreview {
  summary: string;
}

/** Config to scored seats and geometry for live 2D/3D previews (skips text summary generation). */
export function buildLayoutPreview(
  config: LayoutConfig,
  seatTypes: SeatTypeInfo[],
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): BuiltLayoutPreview {
  const { seats: grid, geometry } = generateGrid(config, seatTypes);
  const seats = scoreSeats(grid, config, geometry, defaults);
  return { seats, geometry };
}

/** Config to scored seats, geometry and chatbot summary. */
export function buildLayout(
  config: LayoutConfig,
  seatTypes: SeatTypeInfo[],
  defaults: CinemaDimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
): BuiltLayout {
  const { seats, geometry } = buildLayoutPreview(config, seatTypes, defaults);
  return { seats, geometry, summary: buildLayoutSummary(config, geometry, seats, seatTypes) };
}
