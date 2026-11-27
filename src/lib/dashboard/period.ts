/**
 * Time buckets for the spending dashboard (design 3.1): day, week, month or year, always in Vietnam's calendar (UTC+7, no
 * daylight saving), so "today" and "this month" match what the person actually sees on their phone. Pure: no clock, no
 * database, so every boundary is covered by tests.
 */

export const PERIODS = ["day", "week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];

/** The periods the spending card lets the person pick (no per-day filter). */
export const SPENDING_PERIODS = ["week", "month", "year"] as const satisfies readonly Period[];

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** A half-open range `[start, end)` in real (UTC) instants, labelled for display. */
export interface PeriodBucket {
  key: string;
  start: Date;
  end: Date;
}

/** `instant` shifted so its UTC fields read as Vietnam's local time. Only for computing calendar boundaries, never displayed directly. */
function toVietnamLocal(instant: Date): Date {
  return new Date(instant.getTime() + VIETNAM_OFFSET_MS);
}

/** The reverse of `toVietnamLocal`: a Vietnam-local instant back to the real (UTC) instant it denotes. */
function fromVietnamLocal(local: Date): Date {
  return new Date(local.getTime() - VIETNAM_OFFSET_MS);
}

/** Monday of the ISO week containing `local` (local is already Vietnam-shifted). */
function mondayOf(local: Date): Date {
  const day = local.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diff));
}

/** The start (in Vietnam local calendar fields, as a UTC-labelled Date) of the bucket `offset` periods before the one containing `now`. */
function localStart(period: Period, local: Date, offset: number): Date {
  switch (period) {
    case "day":
      return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - offset));
    case "week": {
      const monday = mondayOf(local);
      return new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() - offset * 7));
    }
    case "month":
      return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - offset, 1));
    case "year":
      return new Date(Date.UTC(local.getUTCFullYear() - offset, 0, 1));
  }
}

function localEnd(period: Period, start: Date): Date {
  switch (period) {
    case "day":
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1));
    case "week":
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 7));
    case "month":
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    case "year":
      return new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
  }
}

function keyOf(period: Period, start: Date): string {
  switch (period) {
    case "day":
      return start.toISOString().slice(0, 10);
    case "week":
      return `${start.toISOString().slice(0, 10)}/week`;
    case "month":
      return start.toISOString().slice(0, 7);
    case "year":
      return String(start.getUTCFullYear());
  }
}

/**
 * `count` buckets of `period`, oldest first, the last one being the one `now` falls in. Each bucket is a real (UTC) instant
 * range, so it can be used directly in a Mongo (or plain JS) date comparison.
 */
export function periodBuckets(period: Period, now: Date, count: number): PeriodBucket[] {
  const local = toVietnamLocal(now);
  const buckets: PeriodBucket[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const start = localStart(period, local, offset);
    const end = localEnd(period, start);
    buckets.push({ key: keyOf(period, start), start: fromVietnamLocal(start), end: fromVietnamLocal(end) });
  }
  return buckets;
}

/** Index of the bucket `at` falls in, or -1 when it is before the first bucket or on/after the last bucket's end. */
export function bucketIndexOf(buckets: readonly PeriodBucket[], at: Date): number {
  return buckets.findIndex((b) => at.getTime() >= b.start.getTime() && at.getTime() < b.end.getTime());
}

/** The first day (Vietnam calendar, YYYY-MM-DD) of the month containing `now`: the window a monthly budget applies to. */
export function currentMonthRange(now: Date): { start: Date; end: Date } {
  const [bucket] = periodBuckets("month", now, 1);
  return { start: bucket.start, end: bucket.end };
}

/** Formats a period bucket key (`2026-09-07/week`, `2026-09`, `2026`) for display in the viewer's locale. */
export function formatPeriodKey(period: Period, key: string, locale: string): string {
  if (period === "year") return key;
  if (period === "month") {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month) return key;
    if (locale !== "en") return `Th${month}`;
    return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  }
  const isoDay = period === "week" ? key.replace(/\/week$/, "") : key;
  const [year, month, day] = isoDay.split("-").map(Number);
  if (!year || !month || !day) return key;
  if (locale !== "en") return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}
