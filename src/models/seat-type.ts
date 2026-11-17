import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** A kind of seat (Standard, VIP, Sweetbox...). `capacity` 2 is a couple seat. */
const seatTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
    capacity: { type: Number, required: true, enum: [1, 2] },
    color: { type: String, trim: true },
  },
  { timestamps: true },
);

seatTypeSchema.index({ name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type SeatTypeDoc = InferSchemaType<typeof seatTypeSchema>;

export const SeatType: Model<SeatTypeDoc> =
  (models.SeatType as Model<SeatTypeDoc> | undefined) ?? model<SeatTypeDoc>("SeatType", seatTypeSchema);
