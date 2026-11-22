import { timingSafeEqual } from "node:crypto";
import { processDeliveries } from "@/notifications/deliver";
import { sendOneSignal } from "@/notifications/onesignal";
import { pushReady } from "@/notifications/provider";
import { sendWebPush } from "@/notifications/push";
import { autoCompleteOverdueAppointments, processScheduledNotifications } from "@/notifications/scheduler";

// Personal data is touched here: always run on request, never cached.
export const dynamic = "force-dynamic";

/** Same length, same bytes: compared in constant time so the secret cannot be guessed a character at a time. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * One round of everything the worker does on a timer: scheduled notifications that came due, pending pushes (retries included) and
 * appointments whose showtime is over. For a host that cannot keep a worker running (Vercel's free plan): Vercel Cron calls it once a day
 * (`vercel.json`) as a safety net. The route has no session; its only key is CRON_SECRET, sent as `Authorization: Bearer <secret>`
 * (Vercel Cron sends it by itself when the variable is set). Without CRON_SECRET the route refuses everyone.
 * Safe to call twice at once: each notification and delivery is claimed with an atomic update before it is sent.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !sameSecret(given, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const scheduled = await processScheduledNotifications();
    const deliveries = pushReady() ? await processDeliveries({ sender: sendWebPush, oneSignal: sendOneSignal }) : 0;
    const completed = await autoCompleteOverdueAppointments();
    return Response.json({ ok: true, scheduled, deliveries, completed });
  } catch {
    console.error("cron: a round failed");
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
