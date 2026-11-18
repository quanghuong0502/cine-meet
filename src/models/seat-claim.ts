import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/**
 * A seat taken in a showtime by one appointment. The unique index on (showtimeId, seatCode) is what stops two appointments from
 * holding the same seat: the second insert fails, whatever order the requests arrive in. Written inside the same transaction as the
 * appointment's own seat list.
 */
const seatClaimSchema = new Schema(
  {
    showtimeId: { type: Schema.Types.ObjectId, ref: "Showtime", required: true },
    seatCode: { type: String, required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

seatClaimSchema.index({ showtimeId: 1, seatCode: 1 }, { unique: true });

export type SeatClaimDoc = InferSchemaType<typeof seatClaimSchema>;

export const SeatClaim: Model<SeatClaimDoc> =
  defineModel<SeatClaimDoc>("SeatClaim", seatClaimSchema);
