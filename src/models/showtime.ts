import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** One screening: a movie in a room, in the layout version the room had when it was created. */
const showtimeSchema = new Schema(
  {
    movieId: { type: Schema.Types.ObjectId, ref: "Movie", required: true, index: true },
    auditoriumId: { type: Schema.Types.ObjectId, ref: "Auditorium", required: true },
    layoutId: { type: Schema.Types.ObjectId, ref: "AuditoriumLayout", required: true },
    startAt: { type: Date, required: true },
    // start + movie length + ad minutes, computed when the showtime is made.
    endAt: { type: Date, required: true },
    formatId: { type: Schema.Types.ObjectId, ref: "Format", required: true },
    // Whole dong; when set it replaces the price rules.
    priceOverride: { type: Number, min: 0 },
  },
  { timestamps: true },
);

showtimeSchema.index({ startAt: 1 });
showtimeSchema.index({ auditoriumId: 1, startAt: 1 });

export type ShowtimeDoc = InferSchemaType<typeof showtimeSchema>;

export const Showtime: Model<ShowtimeDoc> =
  (models.Showtime as Model<ShowtimeDoc> | undefined) ?? model<ShowtimeDoc>("Showtime", showtimeSchema);
