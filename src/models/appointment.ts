import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
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

// Who sits where. A couple seat can hold two people, so the same code may appear twice.
const seatAssignmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seatCode: { type: String, required: true },
  },
  { _id: false },
);

// A food or drink line, priced when it was added so later price changes do not move an estimate. No owner = shared by the group.
const fnbLineSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User" },
  kind: { type: String, enum: ["item", "combo"], required: true },
  refId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 20 },
});

const costSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ticket: { type: Number, required: true, min: 0 },
    fnb: { type: Number, required: true, min: 0 },
    other: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const appointmentSchema = new Schema(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    movieId: { type: Schema.Types.ObjectId, ref: "Movie", required: true },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: "DRAFT", required: true },
    responseDeadline: { type: Date },
    timeOptions: { type: [timeOptionSchema], default: [] },
    chosenOptionId: { type: Schema.Types.ObjectId },
    // The time the group agreed on when the list was locked. Picking a showtime moves `chosenOptionId`, but never earlier than this.
    lockedStartAt: { type: Date },
    // The agreed time came from a real showtime: that showtime is the plan, and it is not picked or changed again.
    showtimeFromPoll: { type: Boolean },
    participants: { type: [participantSchema], default: [] },
    cancelReason: { type: String, trim: true },
    // The creator pays for everyone (set when inviting, fixed afterwards). Seats and food are still chosen per person;
    // this only changes whose `expenses` the viewing's cost lands on when the appointment is completed. Not a debt feature.
    allPaidByCreator: { type: Boolean, default: false },
    // Stage 2 (Sprint 5A).
    showtimeId: { type: Schema.Types.ObjectId, ref: "Showtime" },
    seats: { type: [seatAssignmentSchema], default: [] },
    fnb: { type: [fnbLineSchema], default: [] },
    // Per person, saved whenever seats or food change; the money of each person, as it was worked out.
    estimate: { type: [costSchema], default: [] },
    confirmedAt: { type: Date },
    completedAt: { type: Date },
    // The whole group's real cost; always the sum of everyone's `expenses` for this appointment.
    actualCost: {
      type: new Schema({ ticket: Number, fnb: Number, other: Number, total: Number }, { _id: false }),
    },
  },
  // Two people voting at once must not overwrite each other: a stale save fails and the service retries.
  { timestamps: true, optimisticConcurrency: true },
);

appointmentSchema.index({ creatorId: 1, updatedAt: -1 });
appointmentSchema.index({ creatorId: 1, status: 1 });
appointmentSchema.index({ "participants.userId": 1, status: 1, updatedAt: -1 });
appointmentSchema.index({ status: 1, showtimeId: 1 }, { partialFilterExpression: { status: "CONFIRMED" } });

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema>;

export const Appointment: Model<AppointmentDoc> =
  defineModel<AppointmentDoc>("Appointment", appointmentSchema);
