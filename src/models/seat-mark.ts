import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

import { SEAT_MARK_KINDS, SEAT_MARK_TAGS } from "./seat-mark-constants";

export { SEAT_MARK_KINDS, SEAT_MARK_TAGS };
export type { SeatMarkKind, SeatMarkTag } from "./seat-mark-constants";

/**
 * A person's own mark on one seat. It is stored against the layout version the person was looking at; looking at a newer
 * version still finds it when the seat is still at the same place (see `seat-mark.service`).
 */
const seatMarkSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    auditoriumId: { type: Schema.Types.ObjectId, ref: "Auditorium", required: true },
    layoutId: { type: Schema.Types.ObjectId, ref: "AuditoriumLayout", required: true },
    seatCode: { type: String, required: true },
    kind: { type: String, enum: SEAT_MARK_KINDS, required: true },
    tags: { type: [String], enum: SEAT_MARK_TAGS, default: [] },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

// One mark per person per seat of a room (the newest layout it was made on is kept).
seatMarkSchema.index({ userId: 1, auditoriumId: 1, seatCode: 1 }, { unique: true });
seatMarkSchema.index({ auditoriumId: 1 });

export type SeatMarkDoc = InferSchemaType<typeof seatMarkSchema>;

export const SeatMark: Model<SeatMarkDoc> =
  defineModel<SeatMarkDoc>("SeatMark", seatMarkSchema);
