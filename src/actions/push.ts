"use server";

import { isValidObjectId } from "mongoose";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { buildTestPayload } from "@/notifications/deliver";
import { pushConfig, sendWebPush } from "@/notifications/push";
import { NOTIFICATION_TYPES, type NotificationType } from "@/notifications/types";
import { removeDevice, saveSubscription, sendTestPush, setPushPreference, subscriptionSchema, type TestResult } from "@/services/push.service";

// The person is always the signed-in user; a device or setting of someone else can never be touched.

export async function savePushSubscriptionAction(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success || !pushConfig()) return { ok: false };
  await saveSubscription(user.userId, parsed.data);
  return { ok: true };
}

export async function removePushDeviceAction(deviceId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  return { ok: await removeDevice(user.userId, typeof deviceId === "string" ? deviceId : "") };
}

export async function setPushPreferenceAction(type: string, enabled: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) return { ok: false };
  return { ok: await setPushPreference(user.userId, type as NotificationType, enabled === true) };
}

/** Admin only: sends a test push to the chosen person's devices, in that person's language. */
export async function sendTestPushAction(
  targetId: string,
): Promise<{ ok: true; name: string; result: TestResult } | { ok: false; error: "not_configured" | "not_found" }> {
  await requireAdmin();
  if (!pushConfig()) return { ok: false, error: "not_configured" };
  if (typeof targetId !== "string" || !isValidObjectId(targetId)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const target = await User.findOne({ _id: targetId, role: "user", status: "active" }, "name locale").lean();
  if (!target) return { ok: false, error: "not_found" };
  const payload = await buildTestPayload(target.locale ?? "vi");
  return { ok: true, name: target.name, result: await sendTestPush(targetId, payload, sendWebPush) };
}
