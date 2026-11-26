import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
import { DEFAULT_SEAT_3D_COLOR } from "@/lib/seat-layout/scene";
import { SEAT_STYLES } from "@/lib/seat-layout/types";

/** A kind of seat (Standard, VIP, Sweetbox...). `capacity` 2 is a couple seat. */
const seatTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
    capacity: { type: Number, required: true, enum: [1, 2] },
    style: { type: String, enum: SEAT_STYLES, default: "standard" },
    color: { type: String, trim: true },
    /** Dedicated upholstery color rendered in 3D auditorium views (defaults to cinema velvet red `#8E1E36`). */
    color3d: { type: String, trim: true, default: DEFAULT_SEAT_3D_COLOR },
  },
  { timestamps: true },
);

seatTypeSchema.index({ name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type SeatTypeDoc = InferSchemaType<typeof seatTypeSchema>;

export const SeatType: Model<SeatTypeDoc> =
  defineModel<SeatTypeDoc>("SeatType", seatTypeSchema);
