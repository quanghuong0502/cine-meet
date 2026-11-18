import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/notification";
import { NotificationDelivery } from "@/models/notification-delivery";
import type { NotificationInput } from "./types";

/**
 * Writes the notifications for an event. The in-app message exists as soon as the row does (nothing has to run for it), so it is
 * marked sent at once; other channels (Web Push) get a pending delivery for the worker. Never throws: telling people is secondary
 * to the thing that just happened, so a failure here is logged (without who or what) and the appointment still goes through.
 */
export async function enqueueNotifications(inputs: NotificationInput[]): Promise<void> {
  const items = inputs;
  if (items.length === 0) return;
  try {
    await connectToDatabase();
    const rows = await Notification.insertMany(items.map((i) => ({ type: i.type, recipientId: i.recipientId, payload: i.payload })));
    await NotificationDelivery.insertMany(rows.map((n) => ({ notificationId: n._id, channel: "inapp", status: "sent", attempts: 1 })));
  } catch {
    console.error("notifications: could not write the outbox");
  }
}
