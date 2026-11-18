/** "2026-11-20" and "19:30" typed in Vietnam time -> the ISO instant, or null when either is missing or not a real time. */
export function vietnamToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
