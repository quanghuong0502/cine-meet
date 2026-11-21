import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { describeDevice, type DeviceKind } from "@/lib/device";
import { PushSubscription } from "@/models/push-subscription";
import { User } from "@/models/user";
import { NOTIFICATION_TYPES, type NotificationType } from "@/notifications/types";

export const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine((value) => value.startsWith("https://"), { error: "invalid" }),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  userAgent: z.string().max(400).optional(),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

/** Remembers this browser as a device of the person. The same browser subscribing again (even after another person signed in on it) just moves the row. */
export async function saveSubscription(userId: string, input: SubscriptionInput): Promise<void> {
  await connectToDatabase();
  await PushSubscription.updateOne(
    { endpoint: input.endpoint },
    { $set: { userId, keys: input.keys, userAgent: input.userAgent ?? "" }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
}

export interface DeviceView {
  id: string;
  endpoint: string;
  device: DeviceKind;
  /** ISO strings: this goes to client components. */
  createdAt: string;
  lastUsedAt?: string;
}

export async function listDevices(userId: string): Promise<DeviceView[]> {
  await connectToDatabase();
  const rows = await PushSubscription.find({ userId }).sort({ createdAt: 1 }).lean();
  return rows.map((row) => ({
    id: row._id.toString(),
    endpoint: row.endpoint,
    device: describeDevice(row.userAgent ?? ""),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString(),
  }));
}

/** Turns push off for one device. Only the person's own devices can be removed. */
export async function removeDevice(userId: string, deviceId: string): Promise<boolean> {
  if (!isValidObjectId(deviceId)) return false;
  await connectToDatabase();
  const removed = await PushSubscription.deleteOne({ _id: deviceId, userId });
  return removed.deletedCount > 0;
}

/** The kinds of notification this person has turned off for push. */
export async function getPushOff(userId: string): Promise<NotificationType[]> {
  await connectToDatabase();
  const user = await User.findById(userId, "pushOff").lean().catch(() => null);
  return (user?.pushOff ?? []).filter((type): type is NotificationType => (NOTIFICATION_TYPES as readonly string[]).includes(type));
}

export async function setPushPreference(userId: string, type: NotificationType, enabled: boolean): Promise<boolean> {
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) return false;
  await connectToDatabase();
  const result = await User.updateOne({ _id: userId }, enabled ? { $pull: { pushOff: type } } : { $addToSet: { pushOff: type } });
  return result.matchedCount > 0;
}

/** Of these people, who should get a push of this kind: they have at least one device and have not turned this kind off. */
export async function pushRecipients(userIds: string[], type: NotificationType): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  await connectToDatabase();
  const withDevice = await PushSubscription.distinct("userId", { userId: { $in: userIds } });
  if (withDevice.length === 0) return new Set();
  const wanting = await User.find({ _id: { $in: withDevice }, status: "active", pushOff: { $ne: type } }, "_id").lean();
  return new Set(wanting.map((u) => u._id.toString()));
}

