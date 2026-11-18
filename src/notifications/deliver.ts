import { createTranslator } from "next-intl";
import { connectToDatabase } from "@/lib/db";
import { applyPronouns, DEFAULT_PRONOUNS, type Pronouns } from "@/lib/pronouns";
import { Notification } from "@/models/notification";
import { NotificationDelivery } from "@/models/notification-delivery";
import { PushSubscription } from "@/models/push-subscription";
import { User } from "@/models/user";
import { getPronouns } from "@/services/pronouns.service";
import { getSystemSettings } from "@/services/settings.service";
import type { PushPayload, PushSendOptions, PushSender } from "./push";
import { renderNotification } from "./render";
import { MAX_DELIVERY_ATTEMPTS, type NotificationPayload, type NotificationType } from "./types";

/** A delivery stuck in "processing" this long belongs to a worker that died: another worker takes it. */
const STALE_MS = 2 * 60 * 1000;
/** Wait before try 2 and try 3. */
const BACKOFF_MS = [60_000, 5 * 60_000];

/** Locale of the person who gets it; the Vietnamese messages get the admin's pair of pronouns put in. */
async function loadMessages(locale: "vi" | "en", pronouns: Pronouns): Promise<Record<string, unknown>> {
  const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
  return locale === "vi" ? (applyPronouns(messages as never, pronouns) as Record<string, unknown>) : messages;
}

let pronounCache: { value: Pronouns; at: number } | null = null;
async function currentPronouns(): Promise<Pronouns> {
  if (pronounCache && Date.now() - pronounCache.at < 5 * 60_000) return pronounCache.value;
  const value = await getPronouns().catch(() => DEFAULT_PRONOUNS);
  pronounCache = { value, at: Date.now() };
  return value;
}

/** The words of a push, in the recipient's language. */
export async function buildPushPayload(type: NotificationType, payload: NotificationPayload, locale: "vi" | "en"): Promise<PushPayload> {
  const messages = await loadMessages(locale, await currentPronouns());
  const t = createTranslator({ locale, messages: messages as never, namespace: "notifications.types" as never }) as unknown as (key: string, values?: Record<string, string>) => string;
  return renderNotification(t, type, payload, locale);
}

/** The "send a test" push, in the person's language. */
export async function buildTestPayload(locale: "vi" | "en"): Promise<PushPayload> {
  const messages = await loadMessages(locale, await currentPronouns());
  const t = createTranslator({ locale, messages: messages as never, namespace: "notifications.test" as never }) as unknown as (key: string) => string;
  return { title: t("title"), body: t("body"), url: "/settings" };
}

export interface DeliverOptions {
  sender: PushSender;
  now?: Date;
  /** Most deliveries handled in one call. */
  batch?: number;
}

/**
 * Sends the pending Web Push deliveries. Each one is claimed with an atomic update first, so two workers (or two server processes)
 * never send the same push twice. A device the browser reports as gone loses its subscription and the others still get the push;
 * a temporary failure on every device is retried (up to 3 tries, with a wait between), then given up.
 * Returns how many deliveries it handled.
 */
export async function processDeliveries({ sender, now = new Date(), batch = 25 }: DeliverOptions): Promise<number> {
  await connectToDatabase();
  let handled = 0;
  // The admin's setting is read once per round, and only when there is something to send.
  let ttlSeconds: number | undefined;
  while (handled < batch) {
    const delivery = await NotificationDelivery.findOneAndUpdate(
      {
        channel: "webpush",
        attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
        $or: [{ status: "pending", nextAttemptAt: { $lte: now } }, { status: "processing", updatedAt: { $lte: new Date(now.getTime() - STALE_MS) } }],
      },
      { $set: { status: "processing" }, $inc: { attempts: 1 } },
      { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
    );
    if (!delivery) break;
    handled++;
    ttlSeconds ??= (await getSystemSettings()).pushTtlHours * 3600;
    await deliverOne(delivery._id.toString(), delivery.notificationId.toString(), delivery.attempts, sender, now, { ttlSeconds });
  }
  return handled;
}

async function finish(id: string, status: "sent" | "failed" | "pending", extra: Record<string, unknown> = {}) {
  await NotificationDelivery.updateOne({ _id: id }, { $set: { status, ...extra } });
}

async function deliverOne(deliveryId: string, notificationId: string, attempts: number, sender: PushSender, now: Date, options: PushSendOptions): Promise<void> {
  const notification = await Notification.findById(notificationId).lean();
  if (!notification) return finish(deliveryId, "failed", { error: "notification_missing" });
  const user = await User.findById(notification.recipientId, "locale status").lean();
  if (!user || user.status === "locked") return finish(deliveryId, "sent", { error: "recipient_unavailable" });

  const subscriptions = await PushSubscription.find({ userId: notification.recipientId }).lean();
  // Turned off since it was queued: nothing left to do, and that is not a failure.
  if (subscriptions.length === 0) return finish(deliveryId, "sent", { error: "no_subscription" });

  const payload = await buildPushPayload(notification.type, notification.payload as NotificationPayload, user.locale ?? "vi");
  let delivered = 0;
  let temporaryFailures = 0;
  let lastError = "";
  for (const sub of subscriptions) {
    const outcome = await sender({ endpoint: sub.endpoint, keys: { p256dh: sub.keys?.p256dh ?? "", auth: sub.keys?.auth ?? "" } }, payload, options);
    if (outcome.status === "ok") {
      delivered++;
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastUsedAt: now } });
    } else if (outcome.status === "gone") {
      await PushSubscription.deleteOne({ _id: sub._id });
    } else {
      temporaryFailures++;
      lastError = outcome.message;
    }
  }

  // One device got it: done (retrying would send it twice to that one). All gone: nothing to retry.
  if (delivered > 0 || temporaryFailures === 0) return finish(deliveryId, "sent");
  if (attempts >= MAX_DELIVERY_ATTEMPTS) return finish(deliveryId, "failed", { error: lastError || "gave_up" });
  const wait = BACKOFF_MS[attempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
  return finish(deliveryId, "pending", { nextAttemptAt: new Date(now.getTime() + wait), error: lastError || "retry" });
}
