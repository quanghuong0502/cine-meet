import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** A public holiday. `date` is a Vietnam calendar day written YYYY-MM-DD (no time zone to get wrong). */
const holidaySchema = new Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
  },
  { timestamps: true },
);

holidaySchema.index({ date: 1 }, { unique: true });

export type HolidayDoc = InferSchemaType<typeof holidaySchema>;

export const Holiday: Model<HolidayDoc> =
  (models.Holiday as Model<HolidayDoc> | undefined) ?? model<HolidayDoc>("Holiday", holidaySchema);
