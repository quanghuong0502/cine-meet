import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
import { DISCOUNT_TYPES } from "@/services/pricing/combo-price";

/**
 * A combo of a brand: items of that brand with a quantity each, and a discount. The price is not stored: it is always the sum of the
 * items' current prices minus the discount (src/services/pricing/combo-price.ts), so it never drifts from the item prices.
 * Combos saved before this (with a free-text `description` and a typed `price`) still load; open and save them to pick items.
 */
const fnbComboSchema = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    name: { type: String, required: true, trim: true },
    items: {
      type: [
        {
          _id: false,
          itemId: { type: Schema.Types.ObjectId, ref: "FnbItem", required: true },
          quantity: { type: Number, required: true, min: 1, max: 20 },
        },
      ],
      default: [],
    },
    discountType: { type: String, enum: DISCOUNT_TYPES, default: "amount" },
    // Dong for "amount", 0 to 100 for "percent".
    discountValue: { type: Number, min: 0, default: 0 },
    validFrom: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    validTo: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true },
);

fnbComboSchema.index({ brandId: 1, name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type FnbComboDoc = InferSchemaType<typeof fnbComboSchema>;

export const FnbCombo: Model<FnbComboDoc> =
  defineModel<FnbComboDoc>("FnbCombo", fnbComboSchema);
