/** How long before the answer-by time the "about to expire" notice (#3) goes out. */
export const DEADLINE_WARNING_LEAD_MS = 12 * 60 * 60 * 1000;

/** One row per admin-configured lead time, each at `startAt - minutesBefore`. Past times are dropped: nobody needs a reminder for a moment that already happened. */
export function reminderSendTimes(startAt: Date, minutesBeforeList: number[], now: Date): { minutesBefore: number; sendAt: Date }[] {
  return minutesBeforeList
    .map((minutesBefore) => ({ minutesBefore, sendAt: new Date(startAt.getTime() - minutesBefore * 60_000) }))
    .filter((row) => row.sendAt.getTime() > now.getTime());
}

/** `null` when the deadline is already less than 12h away (or passed): too late for this particular warning to mean anything. */
export function deadlineWarningSendAt(responseDeadline: Date, now: Date): Date | null {
  const sendAt = new Date(responseDeadline.getTime() - DEADLINE_WARNING_LEAD_MS);
  return sendAt.getTime() > now.getTime() ? sendAt : null;
}
