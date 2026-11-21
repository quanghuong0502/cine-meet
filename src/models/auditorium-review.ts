import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** A person's own review of a room (design 3.2): sound, air conditioning, cleanliness, each 1-5, plus a comment. Personal only. */
const auditoriumReviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    auditoriumId: { type: Schema.Types.ObjectId, ref: "Auditorium", required: true },
    sound: { type: Number, required: true, min: 1, max: 5 },
    ac: { type: Number, required: true, min: 1, max: 5 },
    cleanliness: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

auditoriumReviewSchema.index({ userId: 1, auditoriumId: 1 }, { unique: true });

export type AuditoriumReviewDoc = InferSchemaType<typeof auditoriumReviewSchema>;

export const AuditoriumReview: Model<AuditoriumReviewDoc> =
  defineModel<AuditoriumReviewDoc>("AuditoriumReview", auditoriumReviewSchema);
