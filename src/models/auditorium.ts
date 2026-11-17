import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** A screening room of a branch. Its seats live in versioned `AuditoriumLayout` documents. */
const auditoriumSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    name: { type: String, required: true, trim: true },
    /** Newest layout version; saving a layout creates a new version and moves this pointer. */
    currentLayoutId: { type: Schema.Types.ObjectId, ref: "AuditoriumLayout" },
  },
  { timestamps: true },
);

auditoriumSchema.index({ branchId: 1, name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type AuditoriumDoc = InferSchemaType<typeof auditoriumSchema>;

export const Auditorium: Model<AuditoriumDoc> =
  (models.Auditorium as Model<AuditoriumDoc> | undefined) ?? model<AuditoriumDoc>("Auditorium", auditoriumSchema);
