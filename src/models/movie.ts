import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * A movie. Its status (upcoming / showing / ended) is not stored: it follows from today's date and the release and end
 * dates (`movieStatus`), so it can never go stale and no job has to update it.
 */
const movieSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    originalTitle: { type: String, trim: true },
    synopsis: { type: String, trim: true },
    posterUrl: { type: String, trim: true },
    // Only YouTube is supported: the video id is extracted from whatever link the admin pasted.
    trailer: {
      type: new Schema({ provider: { type: String, enum: ["youtube"], required: true }, videoId: { type: String, required: true } }, { _id: false }),
    },
    durationMin: { type: Number, required: true, min: 1, max: 600 },
    genreIds: { type: [Schema.Types.ObjectId], ref: "Genre", default: [] },
    ageRatingId: { type: Schema.Types.ObjectId, ref: "AgeRating" },
    director: { type: String, trim: true },
    cast: { type: String, trim: true },
    language: { type: String, trim: true },
    formatIds: { type: [Schema.Types.ObjectId], ref: "Format", default: [] },
    // Vietnam calendar days YYYY-MM-DD.
    releaseDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true },
);

movieSchema.index({ releaseDate: -1 });
movieSchema.index({ title: 1 });

export type MovieDoc = InferSchemaType<typeof movieSchema>;

export const Movie: Model<MovieDoc> = (models.Movie as Model<MovieDoc> | undefined) ?? model<MovieDoc>("Movie", movieSchema);
