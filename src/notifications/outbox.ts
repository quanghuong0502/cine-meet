import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/notification";
import { NotificationDelivery } from "@/models/notification-delivery";
import { pushRecipients } from "@/services/push.service";
import type { NotificationInput, NotificationType } from "./types";

/**
 * Writes the notifications for an event. The in-app message exists as soon as the row does (nothing has to run for it), so it is
 * marked sent at once; other channels (Web Push) get a pending delivery for the worker. Never throws: telling people is secondary
 * to the thing that just happened, so a failure here is logged (without who or what) and the appointment still goes through.
 */
export async function enqueueNotifications(inputs: NotificationInput[], options: { skipPushFor?: Set<string> } = {}): Promise<void> {
  const items = inputs;
  if (items.length === 0) return;
  try {
    await connectToDatabase();
    const rows = await Notification.insertMany(items.map((i) => ({ type: i.type, recipientId: i.recipientId, payload: i.payload })));
    await NotificationDelivery.insertMany(rows.map((n) => ({ notificationId: n._id, channel: "inapp", status: "sent", attempts: 1 })));
    // `skipPushFor`: people whose phone is already (or will be) told by a push scheduled at OneSignal; they only get the in-app message.
    const toPush = rows.filter((n) => !options.skipPushFor?.has(n.recipientId.toString()));
    await queuePush(toPush.map((n) => ({ id: n._id, recipientId: n.recipientId.toString(), type: n.type })));
  } catch {
    console.error("notifications: could not write the outbox");
  }
}

/** A pending Web Push delivery for each notification whose person has a device and wants this kind pushed. The worker sends them. */
async function queuePush(rows: { id: unknown; recipientId: string; type: NotificationType }[]): Promise<void> {
  const byType = new Map<NotificationType, string[]>();
  for (const row of rows) byType.set(row.type, [...(byType.get(row.type) ?? []), row.recipientId]);
  const wanted = new Map<NotificationType, Set<string>>();
  for (const [type, ids] of byType) wanted.set(type, await pushRecipients(ids, type));
  const pending = rows.filter((row) => wanted.get(row.type)?.has(row.recipientId));
  if (pending.length === 0) return;
  await NotificationDelivery.insertMany(pending.map((row) => ({ notificationId: row.id, channel: "webpush", status: "pending" })));
}
