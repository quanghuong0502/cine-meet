import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** A person's own rating of a movie (design 3.4): personal only, no community score. One row per person per movie. */
const movieRatingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    movieId: { type: Schema.Types.ObjectId, ref: "Movie", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

movieRatingSchema.index({ userId: 1, movieId: 1 }, { unique: true });

export type MovieRatingDoc = InferSchemaType<typeof movieRatingSchema>;

export const MovieRating: Model<MovieRatingDoc> =
  defineModel<MovieRatingDoc>("MovieRating", movieRatingSchema);
