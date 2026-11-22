import { connectToDatabase } from "@/lib/db";
import { processDeliveries } from "./deliver";
import { sendOneSignal } from "./onesignal";
import { pushProvider, pushReady } from "./provider";
import { sendWebPush } from "./push";
import { autoCompleteOverdueAppointments, processScheduledNotifications } from "./scheduler";

const TICK_MS = 5000;
/** Design 4.3: the scheduled-notification sweep (#3, #8, and auto-COMPLETED) runs once a minute, not every tick. */
const SCHEDULE_TICK_MS = 60_000;

let started = false;

/**
 * The background loop, running inside the web process (`instrumentation.ts`, only when ENABLE_WORKER=true): no Agenda, no Redis.
 * It sends pending Web Push deliveries every few seconds, and once a minute sends any scheduled notification that has come due and
 * moves overdue confirmed appointments to COMPLETED. Starting twice in one process does nothing.
 */
export function startWorker(): void {
  if (started) return;
  started = true;
  if (!pushReady()) console.warn(`worker: ${pushProvider() === "onesignal" ? "OneSignal is not set up" : "VAPID keys are not set"}, push is off`);

  const tick = async () => {
    try {
      if (pushReady()) await processDeliveries({ sender: sendWebPush, oneSignal: sendOneSignal });
    } catch {
      console.error("worker: a round failed");
    } finally {
      setTimeout(tick, TICK_MS).unref();
    }
  };
  const scheduleTick = async () => {
    try {
      await processScheduledNotifications();
      await autoCompleteOverdueAppointments();
    } catch {
      console.error("worker: a scheduled-notification round failed");
    } finally {
      setTimeout(scheduleTick, SCHEDULE_TICK_MS).unref();
    }
  };
  // The database may not be ready right at boot; the first round runs a little later.
  void connectToDatabase()
    .catch(() => undefined)
    .finally(() => {
      setTimeout(tick, TICK_MS).unref();
      setTimeout(scheduleTick, SCHEDULE_TICK_MS).unref();
    });
}
