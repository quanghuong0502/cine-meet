export type MovieStatus = "upcoming" | "showing" | "ended";

/** Status from the dates alone (Vietnam calendar days, YYYY-MM-DD): before release, between release and end, after the end date. */
export function movieStatus(movie: { releaseDate: string; endDate?: string | null }, today: string): MovieStatus {
  if (today < movie.releaseDate) return "upcoming";
  if (movie.endDate && today > movie.endDate) return "ended";
  return "showing";
}

/** `date` plus `days` calendar days (YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Whether a movie is offered in the user's filter and poster strip: it is showing now, or it is coming soon within the next
 * `upcomingDays` days (counted from today). Ended movies and movies further out are left out; their page stays reachable.
 */
export function isOfferedInFilter(movie: { releaseDate: string; endDate?: string | null }, today: string, upcomingDays: number): boolean {
  const status = movieStatus(movie, today);
  if (status === "showing") return true;
  return status === "upcoming" && movie.releaseDate <= addDays(today, upcomingDays);
}

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Today in Vietnam as YYYY-MM-DD. */
export function vietnamToday(now: Date = new Date()): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}
