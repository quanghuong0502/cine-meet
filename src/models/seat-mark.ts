import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const SEAT_MARK_KINDS = ["favorite", "avoid"] as const;
export type SeatMarkKind = (typeof SEAT_MARK_KINDS)[number];
export const SEAT_MARK_TAGS = ["aisle", "near_door", "obstructed", "loose", "near_speaker"] as const;
export type SeatMarkTag = (typeof SEAT_MARK_TAGS)[number];

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

export type SeatMarkDoc = InferSchemaType<typeof seatMarkSchema>;

export const SeatMark: Model<SeatMarkDoc> =
  (models.SeatMark as Model<SeatMarkDoc> | undefined) ?? model<SeatMarkDoc>("SeatMark", seatMarkSchema);
