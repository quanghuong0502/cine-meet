import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/**
 * A person's own rating of a seat they actually sat in (design 3.2, 3.4): personal only, shown at their own sitting history.
 * `appointmentId` is set when it came from a planned viewing; missing for a manually logged one.
 */
const seatRatingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    auditoriumId: { type: Schema.Types.ObjectId, ref: "Auditorium", required: true },
    layoutId: { type: Schema.Types.ObjectId, ref: "AuditoriumLayout", required: true },
    seatCode: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
  },
  { timestamps: true },
);

// One rating per person per seat they sat in for a given viewing; without an appointment, one per seat overall.
seatRatingSchema.index(
  { userId: 1, appointmentId: 1, seatCode: 1 },
  { unique: true, partialFilterExpression: { appointmentId: { $exists: true } } },
);
seatRatingSchema.index({ userId: 1, auditoriumId: 1 });

export type SeatRatingDoc = InferSchemaType<typeof seatRatingSchema>;

export const SeatRating: Model<SeatRatingDoc> =
  defineModel<SeatRatingDoc>("SeatRating", seatRatingSchema);
