import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** An age rating (P, T13, T16, T18...). */
const ageRatingSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    descriptionEn: { type: String, trim: true },
    minAge: { type: Number, required: true, min: 0, max: 21 },
  },
  { timestamps: true },
);

ageRatingSchema.index({ code: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type AgeRatingDoc = InferSchemaType<typeof ageRatingSchema>;

export const AgeRating: Model<AgeRatingDoc> =
  (models.AgeRating as Model<AgeRatingDoc> | undefined) ?? model<AgeRatingDoc>("AgeRating", ageRatingSchema);
