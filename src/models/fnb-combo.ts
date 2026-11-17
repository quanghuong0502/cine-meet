import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** A combo of a brand. What is inside is described in text; price in VND (whole dong). */
const fnbComboSchema = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    validFrom: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    validTo: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true },
);

fnbComboSchema.index({ brandId: 1, name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type FnbComboDoc = InferSchemaType<typeof fnbComboSchema>;

export const FnbCombo: Model<FnbComboDoc> =
  (models.FnbCombo as Model<FnbComboDoc> | undefined) ?? model<FnbComboDoc>("FnbCombo", fnbComboSchema);
