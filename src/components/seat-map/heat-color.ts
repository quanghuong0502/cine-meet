/**
 * Heatmap scale: dark blue, teal, yellow (design rule in ui.md: no red, pink or pure green, which clash with
 * `destructive` and `primary`). Fixed colours, the same in light and dark. It is relative to the best and worst seat of THIS
 * layout, because most scores sit in a narrow band and an absolute 0-100 scale would look flat.
 */
const STOPS: [number, number, number][] = [
  [27, 42, 107], // low
  [31, 138, 158],
  [242, 211, 56], // high
];

export function heatColor(score: number, min: number, max: number): string {
  const t = Math.min(1, Math.max(0, max > min ? (score - min) / (max - min) : 1));
  const scaled = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const rgb = STOPS[i].map((from, c) => Math.round(from + (STOPS[i + 1][c] - from) * f));
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}
