const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The instant of a Vietnam wall-clock date ("YYYY-MM-DD") and time ("HH:mm"); null when either is not real. */
export function vietnamInstant(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const utc = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== date) return null;
  return new Date(utc.getTime() - VIETNAM_OFFSET_MS);
}

/** Start of the Vietnam calendar day as an instant. */
export function vietnamDayStart(date: string): Date | null {
  return vietnamInstant(date, "00:00");
}

/** End of a showtime: start, then the movie, then the ads shown before it. */
export function showtimeEnd(start: Date, durationMin: number, adMinutes: number): Date {
  return new Date(start.getTime() + (durationMin + adMinutes) * 60_000);
}

/** Two showtimes in the same room clash when they share any minute (back to back is fine). */
export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Every calendar day from `from` to `to` inclusive (YYYY-MM-DD); empty when either is not a real day or `to` is before `from`. */
export function datesBetween(from: string, to: string, max = 400): string[] {
  const start = vietnamDayStart(from);
  const end = vietnamDayStart(to);
  if (!start || !end || end < start) return [];
  const days: string[] = [];
  for (let day = start.getTime(); day <= end.getTime() && days.length < max; day += 24 * 3600_000) {
    days.push(new Date(day + 7 * 3600_000).toISOString().slice(0, 10));
  }
  return days;
}
