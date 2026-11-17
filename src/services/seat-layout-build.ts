import { generateGrid } from "@/lib/seat-layout/generate";
import { buildLayoutSummary } from "@/lib/seat-layout/summary";
import type { LayoutConfig, LayoutGeometry, LayoutSeat, SeatTypeInfo } from "@/lib/seat-layout/types";
import { scoreSeats } from "./seat-score";

export interface BuiltLayout {
  seats: LayoutSeat[];
  geometry: LayoutGeometry;
  summary: string;
}

/** Config to scored seats, geometry and chatbot summary. Pure: the editor also calls it for the live preview. */
export function buildLayout(config: LayoutConfig, seatTypes: SeatTypeInfo[]): BuiltLayout {
  const { seats: grid, geometry } = generateGrid(config, seatTypes);
  const seats = scoreSeats(grid, config, geometry);
  return { seats, geometry, summary: buildLayoutSummary(config, geometry, seats, seatTypes) };
}
