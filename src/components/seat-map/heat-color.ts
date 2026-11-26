/**
 * Heatmap scale in the app's brand colour, driven by theme CSS tokens (`--heat-low`, `--heat-mid`, `--heat-high`,
 * `--heat-low-fg`, `--heat-high-fg` in globals.css) so both dark and light modes maintain strong contrast on cards.
 */
const LOW = "var(--heat-low)";
const MID = "var(--heat-mid)";
const HIGH = "var(--heat-high)";
/** From this level on the fill swaps to the high-end text token. */
const HIGH_TEXT_FROM = 0.62;

/** Where a score sits between the worst (0) and best (1) normal seat of the layout. */
export function heatLevel(score: number, min: number, max: number): number {
  return Math.min(1, Math.max(0, max > min ? (score - min) / (max - min) : 1));
}

export function heatColor(score: number, min: number, max: number): string {
  const t = heatLevel(score, min, max);
  return t <= 0.5
    ? `color-mix(in oklch, ${LOW}, ${MID} ${Math.round(t * 200)}%)`
    : `color-mix(in oklch, ${MID}, ${HIGH} ${Math.round((t - 0.5) * 200)}%)`;
}

/** High-contrast label text token for either end of the heatmap scale (theme-aware via globals.css). */
export function heatTextColor(score: number, min: number, max: number): string {
  return heatLevel(score, min, max) >= HIGH_TEXT_FROM ? "var(--heat-high-fg)" : "var(--heat-low-fg)";
}

/**
 * The scores the colour scale runs between. Broken or view-blocked seats are left out: their score is far below everyone
 * else's on purpose (a broken seat is 0), and counting them would squeeze every normal seat into the top of the scale.
 * They are still coloured, at the low end. With no normal seat at all, every seat counts.
 */
export function heatRange(seats: { score: number; flags: string[] }[]): { min: number; max: number } {
  const normal = seats.filter((s) => s.flags.length === 0);
  const scores = (normal.length > 0 ? normal : seats).map((s) => s.score);
  return scores.length > 0 ? { min: Math.min(...scores), max: Math.max(...scores) } : { min: 0, max: 0 };
}
