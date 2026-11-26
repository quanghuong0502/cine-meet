import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { describeDevice, type DeviceKind } from "@/lib/device";
import { OneSignalDevice } from "@/models/onesignal-device";
import { PushSubscription } from "@/models/push-subscription";
import { User } from "@/models/user";
import type { OneSignalSender } from "@/notifications/onesignal";
import { pushProvider } from "@/notifications/provider";
import type { PushPayload, PushSendOptions, PushSender } from "@/notifications/push";
import { NOTIFICATION_TYPES, type NotificationType } from "@/notifications/types";

export const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine((value) => value.startsWith("https://"), { error: "invalid" }),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  userAgent: z.string().max(400).optional(),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

/** OneSignal's id for one device's subscription: a UUID, random per device, so knowing it is the same as owning that device. */
export const oneSignalDeviceSchema = z.object({
  subscriptionId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { error: "invalid" }),
  userAgent: z.string().max(400).optional(),
});
export type OneSignalDeviceInput = z.infer<typeof oneSignalDeviceSchema>;

/** Remembers this browser as a OneSignal device of the person. The same browser subscribing again (even after another person signed in on it) just moves the row. */
export async function saveOneSignalDevice(userId: string, input: OneSignalDeviceInput): Promise<DeviceView> {
  await connectToDatabase();
  const row = await OneSignalDevice.findOneAndUpdate(
    { subscriptionId: input.subscriptionId },
    { $set: { userId, userAgent: input.userAgent ?? "" }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return {
    id: row._id.toString(),
    endpoint: row.subscriptionId,
    device: describeDevice(row.userAgent ?? ""),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString(),
  };
}

/** Remembers this browser as a device of the person. The same browser subscribing again (even after another person signed in on it) just moves the row. */
export async function saveSubscription(userId: string, input: SubscriptionInput): Promise<DeviceView> {
  await connectToDatabase();
  const row = await PushSubscription.findOneAndUpdate(
    { endpoint: input.endpoint },
    { $set: { userId, keys: input.keys, userAgent: input.userAgent ?? "" }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return {
    id: row._id.toString(),
    endpoint: row.endpoint,
    device: describeDevice(row.userAgent ?? ""),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString(),
  };
}

export interface DeviceView {
  id: string;
  /** What tells this row's device apart in the browser: the Web Push endpoint, or (with OneSignal) the OneSignal subscription id. */
  endpoint: string;
  device: DeviceKind;
  /** ISO strings: this goes to client components. */
  createdAt: string;
  lastUsedAt?: string;
}

export async function listDevices(userId: string): Promise<DeviceView[]> {
  await connectToDatabase();
  if (pushProvider() === "onesignal") {
    const rows = await OneSignalDevice.find({ userId }, "subscriptionId userAgent createdAt lastUsedAt").sort({ createdAt: 1 }).lean();
    return rows.map((row) => ({
      id: row._id.toString(),
      endpoint: row.subscriptionId,
      device: describeDevice(row.userAgent ?? ""),
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString(),
    }));
  }
  // Never project Web Push encryption keys (`keys.p256dh` / `keys.auth`) when listing devices for UI.
  const rows = await PushSubscription.find({ userId }, "endpoint userAgent createdAt lastUsedAt").sort({ createdAt: 1 }).lean();
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
  const removed =
    pushProvider() === "onesignal" ? await OneSignalDevice.deleteOne({ _id: deviceId, userId }) : await PushSubscription.deleteOne({ _id: deviceId, userId });
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
  const filter = { userId: { $in: userIds } };
  const withDevice = pushProvider() === "onesignal" ? await OneSignalDevice.distinct("userId", filter) : await PushSubscription.distinct("userId", filter);
  if (withDevice.length === 0) return new Set();
  const wanting = await User.find({ _id: { $in: withDevice }, status: "active", pushOff: { $ne: type } }, "_id").lean();
  return new Set(wanting.map((u) => u._id.toString()));
}

export interface TestResult {
  sent: number;
  failed: number;
  removed: number;
  /** Why the failed ones failed (codes like http_403, or the library's own words), so the admin can fix the cause. */
  errors: string[];
}

/** "Send a test": straight to every device of the person, so they can see push works (no retry, no outbox). */
export async function sendTestPush(userId: string, payload: PushPayload, sender: PushSender, options: PushSendOptions): Promise<TestResult> {
  await connectToDatabase();
  const subscriptions = await PushSubscription.find({ userId }).lean();
  const result: TestResult = { sent: 0, failed: 0, removed: 0, errors: [] };
  for (const sub of subscriptions) {
    const outcome = await sender({ endpoint: sub.endpoint, keys: { p256dh: sub.keys?.p256dh ?? "", auth: sub.keys?.auth ?? "" } }, payload, options);
    if (outcome.status === "ok") {
      result.sent++;
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastUsedAt: new Date() } });
    } else if (outcome.status === "gone") {
      result.removed++;
      await PushSubscription.deleteOne({ _id: sub._id });
    } else {
      result.failed++;
      if (!result.errors.includes(outcome.message)) result.errors.push(outcome.message);
    }
  }
  return result;
}

/** "Send a test" through OneSignal: one call with every device of the person; dead ids lose their row. */
export async function sendTestOneSignal(userId: string, payload: PushPayload, sender: OneSignalSender, options: PushSendOptions): Promise<TestResult> {
  await connectToDatabase();
  const devices = await OneSignalDevice.find({ userId }).lean();
  const result: TestResult = { sent: 0, failed: 0, removed: 0, errors: [] };
  if (devices.length === 0) return result;
  const outcome = await sender(devices.map((d) => d.subscriptionId), payload, options);
  if (outcome.invalidIds.length > 0) {
    result.removed = outcome.invalidIds.length;
    await OneSignalDevice.deleteMany({ subscriptionId: { $in: outcome.invalidIds } });
  }
  const reached = devices.length - outcome.invalidIds.length;
  if (outcome.status === "ok") {
    result.sent = reached;
    await OneSignalDevice.updateMany({ _id: { $in: devices.filter((d) => !outcome.invalidIds.includes(d.subscriptionId)).map((d) => d._id) } }, { $set: { lastUsedAt: new Date() } });
  } else {
    result.failed = reached;
    result.errors.push(outcome.message);
  }
  return result;
}

export interface PushTarget {
  id: string;
  name: string;
  deviceCount: number;
}

/** Active regular accounts with how many devices each has push turned on: the list the admin picks from to send a test. */
export async function listPushTargets(): Promise<PushTarget[]> {
  await connectToDatabase();
  const users = await User.find({ role: "user", status: "active" }, "name").sort({ name: 1 }).lean();
  const pipeline = [{ $match: { userId: { $in: users.map((u) => u._id) } } }, { $group: { _id: "$userId", count: { $sum: 1 } } }];
  const counts =
    pushProvider() === "onesignal"
      ? await OneSignalDevice.aggregate<{ _id: unknown; count: number }>(pipeline)
      : await PushSubscription.aggregate<{ _id: unknown; count: number }>(pipeline);
  const byUser = new Map(counts.map((c) => [String(c._id), c.count]));
  return users.map((u) => ({ id: u._id.toString(), name: u.name, deviceCount: byUser.get(u._id.toString()) ?? 0 }));
}
