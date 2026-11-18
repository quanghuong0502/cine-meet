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

/**
 * Short day for a card: "Hôm nay", "Ngày mai", otherwise weekday and date ("Th 7, 21/11"), in Vietnam time and the language in use.
 * Follows the display rule in `.claude/rules/ui.md`. `now` is a parameter so tests do not depend on the clock.
 */
export function formatDayCompact(iso: string, locale: string, now: Date = new Date()): string {
  const days = Math.round((Date.parse(`${vietnamDayKey(iso)}T00:00:00Z`) - Date.parse(`${vietnamDayKey(now.toISOString())}T00:00:00Z`)) / 86_400_000);
  if (days === 0 || days === 1) {
    const word = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" }).format(days, "day");
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: ZONE, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
