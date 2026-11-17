import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** One cinema location of a brand. */
const branchSchema = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    mapsUrl: { type: String, trim: true },
    floor: { type: String, trim: true },
    openingHours: { type: String, trim: true },
    // Parking fee in VND (whole dong), where to park and which entrance to use.
    parkingFee: { type: Number, min: 0 },
    parkingLocation: { type: String, trim: true },
    parkingEntrance: { type: String, trim: true },
  },
  { timestamps: true },
);

branchSchema.index({ brandId: 1, name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type BranchDoc = InferSchemaType<typeof branchSchema>;

export const Branch: Model<BranchDoc> =
  (models.Branch as Model<BranchDoc> | undefined) ?? model<BranchDoc>("Branch", branchSchema);
