import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** A food or drink item sold at a brand's cinemas, in one size. Price in VND (whole dong). */
const fnbItemSchema = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    // Optional: items made before categories existed have none and are listed under "Other".
    categoryId: { type: Schema.Types.ObjectId, ref: "FnbCategory", index: true },
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
    size: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    // Calendar days YYYY-MM-DD in Vietnam time; empty means "always".
    validFrom: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    validTo: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true },
);

fnbItemSchema.index({ brandId: 1, name: 1, size: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type FnbItemDoc = InferSchemaType<typeof fnbItemSchema>;

export const FnbItem: Model<FnbItemDoc> =
  defineModel<FnbItemDoc>("FnbItem", fnbItemSchema);
