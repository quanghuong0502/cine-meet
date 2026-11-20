import { connectToDatabase } from "@/lib/db";
import { Appointment, type AppointmentDoc } from "@/models/appointment";
import { Movie } from "@/models/movie";
import { ScheduledNotification } from "@/models/scheduled-notification";
import { Showtime } from "@/models/showtime";
import { attendeeIdsOf } from "@/services/appointment-estimate";
import { completeAppointment, placeOf } from "@/services/appointment-plan.service";
import { enqueueNotifications } from "./outbox";
import type { NotificationInput } from "./types";

/** A row stuck in "processing" this long belongs to a worker that died: another worker takes it (same idea as `deliver.ts`). */
const STALE_MS = 2 * 60 * 1000;

/** Claims one due (or abandoned) scheduled notification, atomically, so two workers never send the same one twice. */
async function claimOne(now: Date) {
  return ScheduledNotification.findOneAndUpdate(
    { $or: [{ status: "pending", sendAt: { $lte: now } }, { status: "processing", updatedAt: { $lte: new Date(now.getTime() - STALE_MS) } }] },
    { $set: { status: "processing" }, $inc: { attempts: 1 } },
    { sort: { sendAt: 1 }, returnDocument: "after" },
  );
}

function chosenOptionOf(doc: Pick<AppointmentDoc, "timeOptions" | "chosenOptionId">) {
  return doc.timeOptions.find((o) => o._id?.toString() === doc.chosenOptionId?.toString());
}

/** #8: the reminder N minutes before the showtime, with each attendee's own seat. Stale (no longer confirmed) rows are dropped. */
async function sendReminder(appointmentId: string): Promise<boolean> {
  const doc = await Appointment.findById(appointmentId).lean();
  if (!doc || doc.status !== "CONFIRMED" || !doc.showtimeId) return false;
  const [movie, place] = await Promise.all([Movie.findById(doc.movieId, "title").lean(), placeOf(doc.showtimeId.toString())]);
  const slotAt = chosenOptionOf(doc)?.startAt.toISOString();
  const seatByUser = new Map((doc.seats ?? []).map((s) => [s.userId.toString(), s.seatCode]));
  const inputs: NotificationInput[] = attendeeIdsOf(doc as never).map((userId) => ({
    recipientId: userId,
    type: "showtime_reminder",
    payload: { appointmentId, movieTitle: movie?.title ?? "", actorName: "", slotAt, place, seatCode: seatByUser.get(userId) },
  }));
  await enqueueNotifications(inputs);
  return true;
}

/**
 * #3: 12h left to answer, for people who still have not. "Still has not answered" means no vote (yes or no) on any time
 * and the invitation not declined — a "no" vote never turns `participant.status` away from "invited" (only a "yes"
 * does), so that status alone cannot tell a silent person from one who voted no on everything.
 */
async function sendDeadlineWarning(appointmentId: string): Promise<boolean> {
  const doc = await Appointment.findById(appointmentId).lean();
  if (!doc || doc.status !== "INVITING" || !doc.responseDeadline) return false;
  const voted = new Set(doc.timeOptions.flatMap((o) => o.votes.map((v) => v.userId.toString())));
  const recipientIds = doc.participants.filter((p) => p.status === "invited" && !voted.has(p.userId.toString())).map((p) => p.userId.toString());
  if (recipientIds.length === 0) return false;
  const movie = await Movie.findById(doc.movieId, "title").lean();
  const payload = { appointmentId, movieTitle: movie?.title ?? "", actorName: "", slotAt: doc.responseDeadline.toISOString() };
  await enqueueNotifications(recipientIds.map((recipientId) => ({ recipientId, type: "response_deadline_warning" as const, payload })));
  return true;
}

/** Sends every scheduled notification whose time has come. Returns how many it handled (sent or dropped as stale). */
export async function processScheduledNotifications(now = new Date(), batch = 25): Promise<number> {
  await connectToDatabase();
  let handled = 0;
  while (handled < batch) {
    const row = await claimOne(now);
    if (!row) break;
    handled++;
    const sent = row.type === "reminder" ? await sendReminder(row.appointmentId.toString()) : await sendDeadlineWarning(row.appointmentId.toString());
    await ScheduledNotification.updateOne({ _id: row._id }, { $set: { status: sent ? "sent" : "cancelled" } });
  }
  return handled;
}

/** The creator did not mark it watched: once the showtime is over, it moves to COMPLETED on its own (design 3.4, 5B). */
export async function autoCompleteOverdueAppointments(now = new Date()): Promise<number> {
  await connectToDatabase();
  const docs = await Appointment.find({ status: "CONFIRMED", showtimeId: { $exists: true, $ne: null } }, "creatorId showtimeId").lean();
  if (docs.length === 0) return 0;
  const overIds = new Set(
    (await Showtime.find({ _id: { $in: docs.map((d) => d.showtimeId) }, endAt: { $lte: now } }, "_id").lean()).map((s) => s._id.toString()),
  );
  let count = 0;
  for (const doc of docs) {
    if (!overIds.has(doc.showtimeId!.toString())) continue;
    const result = await completeAppointment(doc.creatorId.toString(), doc._id.toString(), now);
    if (result.ok) count++;
  }
  return count;
}
