/**
 * Heatmap scale in the app's brand colour, one hue so it follows the colour the admin picks in Settings. Three stops, so the
 * lightness travels a long way and neighbouring scores stay tellable apart: a dark shade (low), the brand colour itself
 * `--primary` (middle), a pale tint (high). Relative to the best and worst seat of THIS layout, because most scores sit in a
 * narrow band and an absolute 0-100 scale would look flat.
 * The pale end needs dark text; `heatTextColor` picks the text colour for a level.
 */
const LOW = "oklch(0.34 0.08 var(--brand-h))";
const HIGH = "oklch(0.94 0.07 var(--brand-h))";
/** From this level on the fill is light enough that white text would not read. */
const DARK_TEXT_FROM = 0.62;

/** Where a score sits between the worst (0) and best (1) normal seat of the layout. */
export function heatLevel(score: number, min: number, max: number): number {
  return Math.min(1, Math.max(0, max > min ? (score - min) / (max - min) : 1));
}

export function heatColor(score: number, min: number, max: number): string {
  const t = heatLevel(score, min, max);
  return t <= 0.5
    ? `color-mix(in oklch, ${LOW}, var(--primary) ${Math.round(t * 200)}%)`
    : `color-mix(in oklch, var(--primary), ${HIGH} ${Math.round((t - 0.5) * 200)}%)`;
}

/** White on the dark and middle part of the scale, near-black on the pale end. */
export function heatTextColor(score: number, min: number, max: number): string {
  return heatLevel(score, min, max) >= DARK_TEXT_FROM ? "oklch(0.2 0.03 var(--brand-h))" : "#fff";
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
