import { model, models, Schema, type Model } from "mongoose";
import type { LayoutConfig, LayoutSeat } from "@/lib/seat-layout/types";

/**
 * One immutable version of a room's layout. Editing creates a new version (never overwrites),
 * so appointments and showtimes keep pointing at the layout they were made for.
 */
export interface AuditoriumLayoutDoc {
  auditoriumId: Schema.Types.ObjectId;
  version: number;
  config: LayoutConfig;
  seats: LayoutSeat[];
  /** Short Vietnamese description for the chatbot. */
  summary: string;
  createdBy?: Schema.Types.ObjectId;
  createdAt: Date;
}

const seatSchema = new Schema(
  {
    code: { type: String, required: true },
    row: { type: String, required: true },
    col: { type: Number, required: true },
    rowIndex: { type: Number, required: true },
    colIndex: { type: Number, required: true },
    type: { type: String, required: true },
    span: { type: Number, enum: [1, 2], required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    score: { type: Number, required: true },
    flags: { type: [String], enum: ["broken", "obstructed"], default: [] },
  },
  { _id: false },
);

const layoutSchema = new Schema<AuditoriumLayoutDoc>(
  {
    auditoriumId: { type: Schema.Types.ObjectId, ref: "Auditorium", required: true },
    version: { type: Number, required: true, min: 1 },
    // Validated by `layoutConfigSchema` before it gets here.
    config: { type: Schema.Types.Mixed, required: true },
    seats: { type: [seatSchema], default: [] },
    summary: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

layoutSchema.index({ auditoriumId: 1, version: -1 }, { unique: true });

export const AuditoriumLayout: Model<AuditoriumLayoutDoc> =
  (models.AuditoriumLayout as Model<AuditoriumLayoutDoc> | undefined) ??
  model<AuditoriumLayoutDoc>("AuditoriumLayout", layoutSchema);
