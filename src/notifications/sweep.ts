import { autoCompleteOverdueAppointments, processScheduledNotifications } from "./scheduler";

/** At most one sweep this often, per server instance: a person moving between pages should not cost a database round each time. */
const MIN_GAP_MS = 30_000;

let lastRun = 0;
let running: Promise<void> | null = null;

/**
 * Brings scheduled notifications that came due into the person's in-app list, called when they open the app (the layout and the
 * notifications page), just before the list or the bell count is read. This is what makes the in-app message appear on a host that
 * cannot run the worker every minute (Vercel's free plan): a push held at OneSignal rings on time, and the message in the app is there
 * by the time they tap it. When this process runs the worker (ENABLE_WORKER=true) the worker already does it every minute, so this stays out.
 * Never throws: a failed sweep must not take the page down.
 */
export function sweepDueNotifications(now = Date.now()): Promise<void> {
  if (process.env.ENABLE_WORKER === "true") return Promise.resolve();
  if (running) return running;
  if (now - lastRun < MIN_GAP_MS) return Promise.resolve();
  lastRun = now;
  running = Promise.all([processScheduledNotifications(), autoCompleteOverdueAppointments()])
    .then(() => undefined)
    .catch(() => {
      console.error("notifications: could not sweep the due notifications");
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** Test hook: forget the throttle. */
export function resetSweepForTests(): void {
  lastRun = 0;
  running = null;
}
