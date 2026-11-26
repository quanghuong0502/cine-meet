import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/notification";
import { NotificationDelivery } from "@/models/notification-delivery";
import { pushRecipients } from "@/services/push.service";
import { kickDeliveries } from "./kick";
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
    // `skipPushFor`: people whose phone is already (or will be) told by a push scheduled at OneSignal; they only get the in-app message.
    const toPush = rows.filter((n) => !options.skipPushFor?.has(n.recipientId.toString()));
    const pushRows = await selectPushRows(toPush.map((n) => ({ id: n._id, recipientId: n.recipientId.toString(), type: n.type })));
    // Combine in-app and webpush deliveries into a single `insertMany`.
    await NotificationDelivery.insertMany([
      ...rows.map((n) => ({ notificationId: n._id, channel: "inapp" as const, status: "sent" as const, attempts: 1 })),
      ...pushRows.map((row) => ({ notificationId: row.id, channel: "webpush" as const, status: "pending" as const })),
    ]);
    // Right after the response, so the push does not wait for a worker that may not be running (see kick.ts).
    if (pushRows.length > 0) await kickDeliveries();
  } catch {
    console.error("notifications: could not write the outbox");
  }
}

/** Filters notifications whose person has a device and wants this kind pushed. */
async function selectPushRows(rows: { id: unknown; recipientId: string; type: NotificationType }[]) {
  if (rows.length === 0) return [];
  const byType = new Map<NotificationType, string[]>();
  for (const row of rows) byType.set(row.type, [...(byType.get(row.type) ?? []), row.recipientId]);
  const entries = [...byType.entries()];
  const results = await Promise.all(entries.map(([type, ids]) => pushRecipients(ids, type)));
  const wanted = new Map(entries.map(([type], idx) => [type, results[idx]!]));
  return rows.filter((row) => wanted.get(row.type)?.has(row.recipientId));
}
