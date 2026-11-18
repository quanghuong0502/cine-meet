import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** A screening format (2D, 3D, IMAX...). */
const formatSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Off = not offered as a filter or in new pick-lists, and its showtimes are hidden from users (a missing value counts as on).
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

formatSchema.index({ name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type FormatDoc = InferSchemaType<typeof formatSchema>;

export const Format: Model<FormatDoc> =
  defineModel<FormatDoc>("Format", formatSchema);
