import { Appointment, type AppointmentDoc } from "@/models/appointment";
import { Movie } from "@/models/movie";
import type { ScheduledNotificationType } from "@/models/scheduled-notification";
import { attendeeIdsOf } from "@/services/appointment-estimate";
import { placeOf } from "@/services/appointment-plan.service";
import type { NotificationInput } from "./types";

/**
 * Who gets a scheduled notification and what it says, worked out from the appointment as it is right now. Used when the notification
 * comes due (the sweep in `scheduler.ts`) and when it is handed to OneSignal ahead of time (`remote-schedule.ts`): one place, so the
 * two ways can never disagree. An empty list means the notification no longer applies (the appointment moved on), and is dropped.
 */

function chosenOptionOf(doc: Pick<AppointmentDoc, "timeOptions" | "chosenOptionId">) {
  return doc.timeOptions.find((o) => o._id?.toString() === doc.chosenOptionId?.toString());
}

/** #8: the reminder N minutes before the showtime, with each attendee's own seat. Not sent once the plan is no longer confirmed. */
export async function reminderInputs(appointmentId: string): Promise<NotificationInput[]> {
  const doc = await Appointment.findById(appointmentId).lean();
  if (!doc || doc.status !== "CONFIRMED" || !doc.showtimeId) return [];
  const [movie, place] = await Promise.all([Movie.findById(doc.movieId, "title").lean(), placeOf(doc.showtimeId.toString())]);
  const slotAt = chosenOptionOf(doc)?.startAt.toISOString();
  const seatByUser = new Map((doc.seats ?? []).map((s) => [s.userId.toString(), s.seatCode]));
  return attendeeIdsOf(doc as never).map((userId) => ({
    recipientId: userId,
    type: "showtime_reminder" as const,
    payload: { appointmentId, movieTitle: movie?.title ?? "", actorName: "", slotAt, place, seatCode: seatByUser.get(userId) },
  }));
}

/** #9: nudge the group, a few hours after the showtime, to log the real cost and rate their seat. Not sent once it is undone. */
export async function expenseReminderInputs(appointmentId: string): Promise<NotificationInput[]> {
  const doc = await Appointment.findById(appointmentId).lean();
  if (!doc || doc.status !== "COMPLETED") return [];
  const movie = await Movie.findById(doc.movieId, "title").lean();
  return attendeeIdsOf(doc as never).map((userId) => ({
    recipientId: userId,
    type: "expense_reminder" as const,
    payload: { appointmentId, movieTitle: movie?.title ?? "", actorName: "" },
  }));
}

/**
 * #3: 12h left to answer, for people who still have not. "Still has not answered" means no vote (yes or no) on any time
 * and the invitation not declined — a "no" vote never turns `participant.status` away from "invited" (only a "yes"
 * does), so that status alone cannot tell a silent person from one who voted no on everything.
 */
export async function deadlineWarningInputs(appointmentId: string): Promise<NotificationInput[]> {
  const doc = await Appointment.findById(appointmentId).lean();
  if (!doc || doc.status !== "INVITING" || !doc.responseDeadline) return [];
  const voted = new Set(doc.timeOptions.flatMap((o) => o.votes.map((v) => v.userId.toString())));
  const recipientIds = doc.participants.filter((p) => p.status === "invited" && !voted.has(p.userId.toString())).map((p) => p.userId.toString());
  if (recipientIds.length === 0) return [];
  const movie = await Movie.findById(doc.movieId, "title").lean();
  const payload = { appointmentId, movieTitle: movie?.title ?? "", actorName: "", slotAt: doc.responseDeadline.toISOString() };
  return recipientIds.map((recipientId) => ({ recipientId, type: "response_deadline_warning" as const, payload }));
}

export function scheduledInputs(type: ScheduledNotificationType, appointmentId: string): Promise<NotificationInput[]> {
  return type === "reminder" ? reminderInputs(appointmentId) : type === "expense_reminder" ? expenseReminderInputs(appointmentId) : deadlineWarningInputs(appointmentId);
}
