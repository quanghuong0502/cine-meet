export type MovieStatus = "upcoming" | "showing" | "ended";

/** Status from the dates alone (Vietnam calendar days, YYYY-MM-DD): before release, between release and end, after the end date. */
export function movieStatus(movie: { releaseDate: string; endDate?: string | null }, today: string): MovieStatus {
  if (today < movie.releaseDate) return "upcoming";
  if (movie.endDate && today > movie.endDate) return "ended";
  return "showing";
}

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Today in Vietnam as YYYY-MM-DD. */
export function vietnamToday(now: Date = new Date()): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}
