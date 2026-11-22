import { connectToDatabase } from "@/lib/db";
import { Appointment } from "@/models/appointment";
import { ScheduledNotification } from "@/models/scheduled-notification";
import { Showtime } from "@/models/showtime";
import { completeAppointment } from "@/services/appointment-plan.service";
import { enqueueNotifications } from "./outbox";
import { scheduledInputs } from "./scheduled-inputs";

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

/**
 * Sends every scheduled notification whose time has come. Returns how many it handled (sent or dropped as stale).
 * People whose push OneSignal already holds for this moment (`pushIds`, see `remote-schedule.ts`) only get the in-app message here:
 * their phone is told by OneSignal at the right time, and pushing again would ring twice.
 */
export async function processScheduledNotifications(now = new Date(), batch = 25): Promise<number> {
  await connectToDatabase();
  let handled = 0;
  while (handled < batch) {
    const row = await claimOne(now);
    if (!row) break;
    handled++;
    const inputs = await scheduledInputs(row.type, row.appointmentId.toString());
    const skipPushFor = new Set((row.pushIds ?? []).map((p) => p.userId.toString()));
    if (inputs.length > 0) await enqueueNotifications(inputs, { skipPushFor });
    await ScheduledNotification.updateOne({ _id: row._id }, { $set: { status: inputs.length > 0 ? "sent" : "cancelled" } });
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
