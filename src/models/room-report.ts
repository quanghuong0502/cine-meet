import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** A user flagging that a room's layout or info looks wrong (design 2.7, 3.2). Admin reads these; there is no automatic fix. */
export const ROOM_REPORT_STATUSES = ["open", "resolved"] as const;
export type RoomReportStatus = (typeof ROOM_REPORT_STATUSES)[number];

const roomReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    auditoriumId: { type: Schema.Types.ObjectId, ref: "Auditorium", required: true },
    note: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ROOM_REPORT_STATUSES, default: "open", required: true },
  },
  { timestamps: true },
);

roomReportSchema.index({ status: 1, createdAt: -1 });
roomReportSchema.index({ createdAt: -1 });

export type RoomReportDoc = InferSchemaType<typeof roomReportSchema>;

export const RoomReport: Model<RoomReportDoc> =
  defineModel<RoomReportDoc>("RoomReport", roomReportSchema);
