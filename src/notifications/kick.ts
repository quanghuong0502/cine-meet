import { processDeliveries } from "./deliver";
import { sendOneSignal } from "./onesignal";
import { pushReady } from "./provider";
import { sendWebPush } from "./push";

/**
 * Sends the pushes that were just queued, right after the response of the request that queued them (Next's `after`), instead of waiting
 * for the worker. On a host with no worker (Vercel's free plan) this is what makes an invitation arrive in seconds. When this process runs
 * the worker (ENABLE_WORKER=true) the worker picks them up within seconds anyway, so this stays out.
 *
 * A delivery that fails here is not lost: it stays in the queue and is retried by the next sweep (the worker, or the daily cron).
 * Outside a request (a script, a test, the worker itself) there is no `after` to use: that is fine, and nothing happens.
 */
export async function kickDeliveries(): Promise<void> {
  if (process.env.ENABLE_WORKER === "true" || !pushReady()) return;
  try {
    const { after } = await import("next/server");
    after(async () => {
      try {
        await processDeliveries({ sender: sendWebPush, oneSignal: sendOneSignal });
      } catch {
        console.error("notifications: sending right after the request failed");
      }
    });
  } catch {
    // Not inside a Next request: the worker or the cron will send it.
  }
}
