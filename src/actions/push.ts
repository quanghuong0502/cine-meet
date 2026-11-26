"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { buildTestPayload } from "@/notifications/deliver";
import { sendOneSignal } from "@/notifications/onesignal";
import { pushProvider, pushReady } from "@/notifications/provider";
import { sendWebPush } from "@/notifications/push";
import { NOTIFICATION_TYPES, type NotificationType } from "@/notifications/types";
import { getSystemSettings } from "@/services/settings.service";
import {
  oneSignalDeviceSchema,
  removeDevice,
  saveOneSignalDevice,
  saveSubscription,
  sendTestOneSignal,
  sendTestPush,
  setPushPreference,
  subscriptionSchema,
  type DeviceView,
  type TestResult,
} from "@/services/push.service";

// The person is always the signed-in user; a device or setting of someone else can never be touched.

export async function savePushSubscriptionAction(input: unknown): Promise<{ ok: true; device: DeviceView } | { ok: false }> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success || pushProvider() !== "webpush" || !pushReady()) return { ok: false };
  const device = await saveSubscription(user.userId, parsed.data);
  revalidatePath("/settings");
  return { ok: true, device };
}

/** With OneSignal: remembers the browser's OneSignal subscription id as a device of the signed-in person. */
export async function saveOneSignalDeviceAction(input: unknown): Promise<{ ok: true; device: DeviceView } | { ok: false }> {
  const user = await requireUser();
  const parsed = oneSignalDeviceSchema.safeParse(input);
  if (!parsed.success || pushProvider() !== "onesignal" || !pushReady()) return { ok: false };
  const device = await saveOneSignalDevice(user.userId, parsed.data);
  revalidatePath("/settings");
  return { ok: true, device };
}

export async function removePushDeviceAction(deviceId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const ok = await removeDevice(user.userId, typeof deviceId === "string" ? deviceId : "");
  if (ok) revalidatePath("/settings");
  return { ok };
}

export async function setPushPreferenceAction(type: string, enabled: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) return { ok: false };
  const ok = await setPushPreference(user.userId, type as NotificationType, enabled === true);
  if (ok) revalidatePath("/settings");
  return { ok };
}

/** Admin only: sends a test push to the chosen person's devices, in that person's language. */
export async function sendTestPushAction(
  targetId: string,
): Promise<{ ok: true; name: string; result: TestResult } | { ok: false; error: "not_configured" | "not_found" }> {
  await requireAdmin();
  if (!pushReady()) return { ok: false, error: "not_configured" };
  if (typeof targetId !== "string" || !isValidObjectId(targetId)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const target = await User.findOne({ _id: targetId, role: "user", status: "active" }, "name locale").lean();
  if (!target) return { ok: false, error: "not_found" };
  const payload = await buildTestPayload(target.locale ?? "vi");
  const options = { ttlSeconds: (await getSystemSettings()).pushTtlHours * 3600 };
  const result =
    pushProvider() === "onesignal" ? await sendTestOneSignal(targetId, payload, sendOneSignal, options) : await sendTestPush(targetId, payload, sendWebPush, options);
  return { ok: true, name: target.name, result };
}
