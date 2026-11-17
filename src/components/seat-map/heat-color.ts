/**
 * Heatmap colour for a seat score, relative to the best and worst seat of THIS layout
 * (most scores sit in a narrow band, so an absolute 0-100 scale would look all green).
 * Red = low, green = high; lightness rises too so it still reads without telling red from green.
 */
export function heatColor(score: number, min: number, max: number): string {
  const t = max > min ? (score - min) / (max - min) : 1;
  const hue = Math.round(8 + t * 122);
  const lightness = Math.round(38 + t * 14);
  return `hsl(${hue} 68% ${lightness}%)`;
}
