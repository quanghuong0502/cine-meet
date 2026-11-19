import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** A kind of food or drink (Popcorn, Drinks, Snacks...), used to group and filter the items when picking food. */
const fnbCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
    // Off = not offered in new pick-lists (a missing value counts as on).
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

fnbCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type FnbCategoryDoc = InferSchemaType<typeof fnbCategorySchema>;

export const FnbCategory: Model<FnbCategoryDoc> =
  defineModel<FnbCategoryDoc>("FnbCategory", fnbCategorySchema);
