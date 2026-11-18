import { connectToDatabase } from "@/lib/db";
import { processDeliveries } from "./deliver";
import { pushConfig, sendWebPush } from "./push";

const TICK_MS = 5000;

let started = false;

/**
 * The background loop, running inside the web process (`instrumentation.ts`, only when ENABLE_WORKER=true): no Agenda, no Redis.
 * It sends pending Web Push deliveries every few seconds. Starting twice in one process does nothing.
 */
export function startWorker(): void {
  if (started) return;
  started = true;
  if (!pushConfig()) console.warn("worker: VAPID keys are not set, Web Push is off");

  const tick = async () => {
    try {
      if (pushConfig()) await processDeliveries({ sender: sendWebPush });
    } catch {
      console.error("worker: a round failed");
    } finally {
      setTimeout(tick, TICK_MS).unref();
    }
  };
  // The database may not be ready right at boot; the first round runs a little later.
  void connectToDatabase()
    .catch(() => undefined)
    .finally(() => setTimeout(tick, TICK_MS).unref());
}
