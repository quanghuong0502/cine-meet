import { connectToDatabase } from "@/lib/db";
import { OneSignalDevice } from "@/models/onesignal-device";
import { ScheduledNotification } from "@/models/scheduled-notification";
import { User } from "@/models/user";
import { pushRecipients } from "@/services/push.service";
import { getSystemSettings } from "@/services/settings.service";
import { buildPushPayload } from "./deliver";
import { cancelOneSignal, sendOneSignal } from "./onesignal";
import { oneSignalConfig, pushProvider } from "./provider";
import { scheduledInputs } from "./scheduled-inputs";

/** OneSignal holds a message at most 30 days; a day less, so a clock a little off never tips a row over the edge. */
const MAX_AHEAD_MS = 29 * 24 * 3600 * 1000;

/**
 * With PUSH_PROVIDER=onesignal: hands the push of one scheduled notification to OneSignal now, held until it is due (one message per
 * person: the words carry their own seat, language and pronouns). This is what lets reminders arrive on time on a host that cannot
 * run a worker every minute. The row stays the record: it keeps each person's message id (`pushIds`) so it can be taken back when the
 * plan changes. The in-app message is still written by the sweep when the row comes due (`scheduler.ts`), for these people without a second push.
 *
 * Never throws and never blocks the thing that just happened. When nothing is handed over (not OneSignal, too far ahead, nobody wants
 * it, OneSignal unreachable) the row simply has no `pushIds` and the sweep sends the push itself when the time comes.
 * Returns how many people's pushes OneSignal now holds.
 */
export async function scheduleRemotely(rowId: string, now = new Date()): Promise<number> {
  if (pushProvider() !== "onesignal" || !oneSignalConfig()) return 0;
  try {
    await connectToDatabase();
    const row = await ScheduledNotification.findById(rowId).lean();
    if (!row || row.status !== "pending") return 0;
    const wait = row.sendAt.getTime() - now.getTime();
    if (wait <= 0 || wait > MAX_AHEAD_MS) return 0;

    const inputs = await scheduledInputs(row.type, row.appointmentId.toString());
    if (inputs.length === 0) return 0;
    const wanted = await pushRecipients(
      inputs.map((i) => i.recipientId),
      inputs[0]!.type,
    );
    const targets = inputs.filter((i) => wanted.has(i.recipientId));
    if (targets.length === 0) return 0;

    const targetIds = [...new Set(targets.map((t) => t.recipientId))];
    const [settings, users, allDevices] = await Promise.all([
      getSystemSettings(),
      User.find({ _id: { $in: targetIds } }, "locale").lean(),
      OneSignalDevice.find({ userId: { $in: targetIds } }, "userId subscriptionId").lean(),
    ]);
    const ttlSeconds = settings.pushTtlHours * 3600;
    const localeOf = new Map(users.map((u) => [u._id.toString(), u.locale ?? "vi"]));
    const devicesByUser = new Map<string, string[]>();
    for (const d of allDevices) {
      const uid = d.userId.toString();
      devicesByUser.set(uid, [...(devicesByUser.get(uid) ?? []), d.subscriptionId]);
    }
    const held: { userId: string; id: string }[] = [];
    const invalidIds: string[] = [];
    for (const target of targets) {
      const subIds = devicesByUser.get(target.recipientId);
      if (!subIds || subIds.length === 0) continue;
      const payload = await buildPushPayload(target.type, target.payload, localeOf.get(target.recipientId) ?? "vi");
      const result = await sendOneSignal(subIds, payload, { ttlSeconds, sendAfter: row.sendAt });
      if (result.invalidIds.length > 0) invalidIds.push(...result.invalidIds);
      if (result.status === "ok" && result.id) held.push({ userId: target.recipientId, id: result.id });
    }
    if (invalidIds.length > 0) await OneSignalDevice.deleteMany({ subscriptionId: { $in: [...new Set(invalidIds)] } });
    if (held.length === 0) return 0;

    // The row may have been cancelled or replaced while the messages were being handed over: then take them straight back.
    const saved = await ScheduledNotification.updateOne({ _id: rowId, status: "pending" }, { $set: { pushIds: held } });
    if (saved.matchedCount === 0) {
      await cancelRemote(held.map((h) => h.id));
      return 0;
    }
    return held.length;
  } catch {
    console.error("notifications: could not hand a scheduled push to OneSignal");
    return 0;
  }
}

/** Takes back messages held at OneSignal. Best effort: one that cannot be reached is counted in the log, and the rest still go. */
export async function cancelRemote(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const results = await Promise.all(messageIds.map((id) => cancelOneSignal(id)));
  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) console.error(`notifications: ${failed} scheduled push(es) could not be cancelled at OneSignal`);
}
