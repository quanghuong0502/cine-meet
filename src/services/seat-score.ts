import type { GridSeat, LayoutConfig, LayoutGeometry, LayoutSeat } from "@/lib/seat-layout/types";

/**
 * Seat score (design 2.3): 100 minus penalties. The numbers below are judgement calls,
 * not sourced from any standard; they live here so they can be tuned in one place.
 */
export const SCORE_WEIGHTS = {
  /** Max loss for a seat at the room's side wall (normalized horizontal deviation 1). */
  lateral: 30,
  /** Max loss for the worst depth (normalized depth deviation 1). */
  depth: 40,
  /** Loss for a seat in a flat row when the room has a stadium section behind it. */
  flatRow: 8,
  /** Max loss right next to an entrance, fading to 0 at `entranceReach`. */
  entrance: 8,
  entranceReach: 2.5,
  broken: 50,
  obstructed: 25,
} as const;

/** Ideal depth as a share of the distance from screen to last row (60 to 70%, design 2.3). */
const BASE_IDEAL_DEPTH = 0.65;
const DISTANCE_SHIFT = { near: 0.03, medium: 0, far: -0.05 } as const;

/** Where the best depth sits (0 = screen, 1 = last row): a wider screen pushes it back. */
export function idealDepthShare(config: LayoutConfig): number {
  const { widthPct, distance } = config.screen;
  const share = BASE_IDEAL_DEPTH + ((widthPct - 85) / 100) * 0.2 + DISTANCE_SHIFT[distance];
  return Math.min(0.8, Math.max(0.5, share));
}

export function scoreSeat(seat: GridSeat, config: LayoutConfig, geometry: LayoutGeometry): number {
  const w = SCORE_WEIGHTS;
  // Ideal horizontal centre follows the screen slider (design 2.3): the screen centre.
  const idealX = (geometry.screen.x1 + geometry.screen.x2) / 2;
  const lateral = Math.min(1, Math.abs(seat.x - idealX) / (geometry.width / 2));

  const ideal = idealDepthShare(config);
  const depthShare = seat.y / geometry.lastRowY;
  const depth = Math.min(1, Math.abs(depthShare - ideal) / Math.max(ideal, 1 - ideal));

  let score = 100 - w.lateral * lateral - w.depth * depth;

  // Without stadium info the flat/raised split is unknown, so no penalty.
  if (config.stadiumFromRow !== null && seat.rowIndex + 1 < config.stadiumFromRow) score -= w.flatRow;

  for (const e of geometry.entrances) {
    const distance = Math.hypot(seat.x - e.x, seat.y - e.y);
    if (distance < w.entranceReach) score -= w.entrance * (1 - distance / w.entranceReach);
  }

  if (seat.flags.includes("broken")) score -= w.broken;
  if (seat.flags.includes("obstructed")) score -= w.obstructed;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function scoreSeats(seats: GridSeat[], config: LayoutConfig, geometry: LayoutGeometry): LayoutSeat[] {
  return seats.map((seat) => ({ ...seat, score: scoreSeat(seat, config, geometry) }));
}
