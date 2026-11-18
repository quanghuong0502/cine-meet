"use server";

import { requireUser } from "@/lib/auth/guards";
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

export async function sendTestPushAction(): Promise<{ ok: true; result: TestResult } | { ok: false; error: "not_configured" }> {
  const user = await requireUser();
  if (!pushConfig()) return { ok: false, error: "not_configured" };
  const payload = await buildTestPayload(user.locale ?? "vi");
  return { ok: true, result: await sendTestPush(user.userId, payload, sendWebPush) };
}
