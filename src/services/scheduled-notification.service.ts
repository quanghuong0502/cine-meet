import { connectToDatabase } from "@/lib/db";
import { deadlineWarningSendAt, expenseReminderSendAt, reminderSendTimes } from "@/lib/appointment/reminders";
import { Appointment } from "@/models/appointment";
import { ScheduledNotification, type ScheduledNotificationType } from "@/models/scheduled-notification";
import { getSystemSettings } from "@/services/settings.service";

/** Cancels the still-pending rows of one appointment (optionally only one type). Sent rows are left alone: history. */
export async function cancelScheduled(appointmentId: string, types?: ScheduledNotificationType[]): Promise<void> {
  await connectToDatabase();
  await ScheduledNotification.updateMany(
    { appointmentId, status: "pending", ...(types ? { type: { $in: types } } : {}) },
    { $set: { status: "cancelled" } },
  );
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
  await ScheduledNotification.insertMany(rows.map((r) => ({ appointmentId, type: "reminder" as const, minutesBefore: r.minutesBefore, sendAt: r.sendAt })));
}

/** The "about to expire" warning (#3), 12h before the answer-by time. One row; replaces any row already scheduled for this appointment. */
export async function scheduleDeadlineWarning(appointmentId: string, responseDeadline: Date, now = new Date()): Promise<void> {
  await connectToDatabase();
  await cancelScheduled(appointmentId, ["deadline_warning"]);
  const sendAt = deadlineWarningSendAt(responseDeadline, now);
  if (!sendAt) return;
  await ScheduledNotification.create({ appointmentId, type: "deadline_warning", sendAt });
}

/** The nudge to log real cost and rate the seat (#9), ~3h after the showtime ends. One row; set when the appointment is marked watched. */
export async function scheduleExpenseReminder(appointmentId: string, endAt: Date): Promise<void> {
  await connectToDatabase();
  await cancelScheduled(appointmentId, ["expense_reminder"]);
  await ScheduledNotification.create({ appointmentId, type: "expense_reminder", sendAt: expenseReminderSendAt(endAt) });
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
