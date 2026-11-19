import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/notification";
import type { NotificationPayload, NotificationType } from "@/notifications/types";

export interface NotificationView {
  id: string;
  type: NotificationType;
  payload: NotificationPayload;
  /** ISO string: this goes to client components. */
  createdAt: string;
  read: boolean;
}

const PAGE_SIZE = 50;

/** The person's newest notifications first. Only their own: `userId` comes from the session. */
export async function listNotifications(userId: string, limit = PAGE_SIZE): Promise<NotificationView[]> {
  await connectToDatabase();
  const rows = await Notification.find({ recipientId: userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    payload: n.payload as NotificationPayload,
    createdAt: n.createdAt.toISOString(),
    read: Boolean(n.readAt),
  }));
}

export async function countUnread(userId: string): Promise<number> {
  await connectToDatabase();
  return Notification.countDocuments({ recipientId: userId, readAt: { $exists: false } });
}

export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  if (!isValidObjectId(notificationId)) return false;
  await connectToDatabase();
  const result = await Notification.updateOne({ _id: notificationId, recipientId: userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  return result.modifiedCount > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  await connectToDatabase();
  const result = await Notification.updateMany({ recipientId: userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  return result.modifiedCount;
}
