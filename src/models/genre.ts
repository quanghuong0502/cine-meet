import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** A movie genre (Action, Comedy...). */
const genreSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
    // Off = not offered as a filter or in new pick-lists (a missing value counts as on).
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

genreSchema.index({ name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type GenreDoc = InferSchemaType<typeof genreSchema>;

export const Genre: Model<GenreDoc> =
  (models.Genre as Model<GenreDoc> | undefined) ?? model<GenreDoc>("Genre", genreSchema);
