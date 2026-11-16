import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** A cinema chain (CGV, BHD, Beta, Lotte, Galaxy...). */
const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    logoUrl: { type: String, trim: true },
    // Brand colour as #rrggbb, used to tint cards and chips.
    color: { type: String, trim: true },
    websiteUrl: { type: String, trim: true },
    appUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

// Names are unique ignoring case and accents ("cgv" equals "CGV").
brandSchema.index({ name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type BrandDoc = InferSchemaType<typeof brandSchema>;

export const Brand: Model<BrandDoc> =
  (models.Brand as Model<BrandDoc> | undefined) ?? model<BrandDoc>("Brand", brandSchema);
