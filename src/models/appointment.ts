import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { APPOINTMENT_STATUSES, PARTICIPANT_STATUSES } from "@/lib/appointment/state";

const voteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vote: { type: String, enum: ["yes", "no"], required: true },
  },
  { _id: false },
);

// One candidate time of the poll. It may point at a real showtime; then `startAt` is that showtime's start.
const timeOptionSchema = new Schema({
  startAt: { type: Date, required: true },
  showtimeId: { type: Schema.Types.ObjectId, ref: "Showtime" },
  proposedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // When the creator last nudged the people who had not voted on this time (limits how often they can).
  lastRemindedAt: { type: Date },
  votes: { type: [voteSchema], default: [] },
});

const participantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // invited: no answer yet · accepted: said yes to a time (or was added by the creator when locking) · declined: refused the whole invite
    // dropped: left after the list was locked · excluded: the creator left them out when locking
    status: { type: String, enum: PARTICIPANT_STATUSES, default: "invited", required: true },
    declineReason: { type: String, trim: true },
  },
  { _id: false },
);

const appointmentSchema = new Schema(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    movieId: { type: Schema.Types.ObjectId, ref: "Movie", required: true },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: "DRAFT", required: true },
    responseDeadline: { type: Date },
    timeOptions: { type: [timeOptionSchema], default: [] },
    chosenOptionId: { type: Schema.Types.ObjectId },
    participants: { type: [participantSchema], default: [] },
    cancelReason: { type: String, trim: true },
  },
  // Two people voting at once must not overwrite each other: a stale save fails and the service retries.
  { timestamps: true, optimisticConcurrency: true },
);

appointmentSchema.index({ "participants.userId": 1 });

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema>;

export const Appointment: Model<AppointmentDoc> =
  (models.Appointment as Model<AppointmentDoc> | undefined) ?? model<AppointmentDoc>("Appointment", appointmentSchema);
