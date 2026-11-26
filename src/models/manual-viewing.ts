import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/**
 * A viewing logged by hand (design 3.4 "Bổ sung"): watched alone, or booked outside the app. Feeds the same dashboard and
 * "frequently visited" counts as a completed appointment (see `viewing-history.service`), but has no poll, no seats held and
 * no other attendees. `movieId`/`auditoriumId` are optional: a person may only know the movie, or nothing precise at all.
 */
const manualViewingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    movieId: { type: Schema.Types.ObjectId, ref: "Movie" },
    auditoriumId: { type: Schema.Types.ObjectId, ref: "Auditorium" },
    layoutId: { type: Schema.Types.ObjectId, ref: "AuditoriumLayout" },
    seatCode: { type: String, trim: true },
    // Vietnam calendar day YYYY-MM-DD the person watched it.
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

manualViewingSchema.index({ userId: 1, date: -1 });

export type ManualViewingDoc = InferSchemaType<typeof manualViewingSchema>;

export const ManualViewing: Model<ManualViewingDoc> =
  defineModel<ManualViewingDoc>("ManualViewing", manualViewingSchema);
