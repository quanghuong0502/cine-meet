/** Date and time display for the language in use. The time zone is always Vietnam, whatever the device says. */
const ZONE = "Asia/Ho_Chi_Minh";
const intlLocale = (locale: string) => (locale === "en" ? "en-GB" : "vi-VN");

/** "19:30" */
export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** "Thứ Sáu, 20 tháng 11" */
export function formatDayLong(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: ZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** "2026-11-20" in Vietnam: groups showtimes by day. */
export function vietnamDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD day as a label for the language in use. */
export function formatDayKey(key: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${key}T00:00:00Z`));
}
