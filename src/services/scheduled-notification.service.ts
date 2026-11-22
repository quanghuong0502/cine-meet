import { connectToDatabase } from "@/lib/db";
import { deadlineWarningSendAt, expenseReminderSendAt, reminderSendTimes } from "@/lib/appointment/reminders";
import { Appointment } from "@/models/appointment";
import { ScheduledNotification, type ScheduledNotificationType } from "@/models/scheduled-notification";
import { pushProvider } from "@/notifications/provider";
import { getSystemSettings } from "@/services/settings.service";

// The push side of a scheduled notification can be held at OneSignal ahead of time (PUSH_PROVIDER=onesignal, `remote-schedule.ts`).
// It is imported on use: that module reaches the appointment services, which reach this one.

/** Hands the pushes of freshly created rows to OneSignal. Does nothing (and never throws) unless OneSignal is the provider. */
async function holdRemotely(rowIds: unknown[]): Promise<void> {
  // Web Push (the default): nothing to hand over, so do not even load the OneSignal side.
  if (pushProvider() !== "onesignal") return;
  try {
    const { scheduleRemotely } = await import("@/notifications/remote-schedule");
    for (const id of rowIds) await scheduleRemotely(String(id));
  } catch {
    console.error("notifications: could not hand a scheduled push to the provider");
  }
}

/**
 * Cancels the still-pending rows of one appointment (optionally only one type), and takes back the pushes OneSignal was holding for
 * them, so a cancelled plan does not still ring a phone. Sent rows are left alone: history.
 */
export async function cancelScheduled(appointmentId: string, types?: ScheduledNotificationType[]): Promise<void> {
  await connectToDatabase();
  const filter = { appointmentId, status: "pending" as const, ...(types ? { type: { $in: types } } : {}) };
  const held = await ScheduledNotification.find({ ...filter, "pushIds.0": { $exists: true } }, "pushIds").lean();
  if (held.length > 0) {
    const { cancelRemote } = await import("@/notifications/remote-schedule");
    await cancelRemote(held.flatMap((row) => row.pushIds.map((p) => p.id)));
  }
  await ScheduledNotification.updateMany(filter, { $set: { status: "cancelled" } });
}

/**
 * One person no longer needs the "about to expire" warning (they answered, declined or left): takes back only their held push.
 * Does nothing when no push is held for them (every non-OneSignal setup), so it is cheap to call on every answer.
 */
export async function dropDeadlineWarningFor(appointmentId: string, userId: string): Promise<void> {
  await connectToDatabase();
  const rows = await ScheduledNotification.find({ appointmentId, type: "deadline_warning", status: "pending", "pushIds.userId": userId }, "pushIds").lean();
  if (rows.length === 0) return;
  const { cancelRemote } = await import("@/notifications/remote-schedule");
  for (const row of rows) {
    await cancelRemote(row.pushIds.filter((p) => p.userId.toString() === userId).map((p) => p.id));
    await ScheduledNotification.updateOne({ _id: row._id }, { $pull: { pushIds: { userId } } });
  }
}

/**
 * The reminders (#8) for one appointment's showtime: replaces whatever was scheduled before with one row per configured lead time
 * that is still ahead of `now`. Called when the plan is confirmed, and again whenever the admin changes the lead times.
 */
export async function scheduleReminders(appointmentId: string, startAt: Date, now = new Date()): Promise<void> {
  await connectToDatabase();
  await cancelScheduled(appointmentId, ["reminder"]);
  const { reminderMinutesBefore } = await getSystemSettings();
  const rows = reminderSendTimes(startAt, reminderMinutesBefore, now);
  if (rows.length === 0) return;
  const created = await ScheduledNotification.insertMany(rows.map((r) => ({ appointmentId, type: "reminder" as const, minutesBefore: r.minutesBefore, sendAt: r.sendAt })));
  await holdRemotely(created.map((row) => row._id));
}

/** The "about to expire" warning (#3), 12h before the answer-by time. One row; replaces any row already scheduled for this appointment. */
export async function scheduleDeadlineWarning(appointmentId: string, responseDeadline: Date, now = new Date()): Promise<void> {
  await connectToDatabase();
  await cancelScheduled(appointmentId, ["deadline_warning"]);
  const sendAt = deadlineWarningSendAt(responseDeadline, now);
  if (!sendAt) return;
  const created = await ScheduledNotification.create({ appointmentId, type: "deadline_warning", sendAt });
  await holdRemotely([created._id]);
}

/** The nudge to log real cost and rate the seat (#9), ~3h after the showtime ends. One row; set when the appointment is marked watched. */
export async function scheduleExpenseReminder(appointmentId: string, endAt: Date): Promise<void> {
  await connectToDatabase();
  await cancelScheduled(appointmentId, ["expense_reminder"]);
  const created = await ScheduledNotification.create({ appointmentId, type: "expense_reminder", sendAt: expenseReminderSendAt(endAt) });
  await holdRemotely([created._id]);
}

/** Admin changed `reminderMinutesBefore`: every confirmed, not-yet-started appointment gets its reminders recomputed from scratch. */
export async function recomputeAllReminders(now = new Date()): Promise<number> {
  await connectToDatabase();
  const docs = await Appointment.find({ status: "CONFIRMED", showtimeId: { $exists: true } }, "chosenOptionId timeOptions").lean();
  let count = 0;
  for (const doc of docs) {
    const option = doc.timeOptions.find((o) => o._id.toString() === doc.chosenOptionId?.toString());
    if (!option || option.startAt.getTime() <= now.getTime()) continue;
    await scheduleReminders(doc._id.toString(), option.startAt, now);
    count++;
  }
  return count;
}
