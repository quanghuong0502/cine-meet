import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
import { DAY_TYPES } from "@/services/pricing/ticket-price";

/** A ticket price for a brand or a branch, optionally narrowed by format, seat type, day type and start time. */
const priceRuleSchema = new Schema(
  {
    // Exactly one of the two.
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true },
    formatId: { type: Schema.Types.ObjectId, ref: "Format" },
    seatTypeId: { type: Schema.Types.ObjectId, ref: "SeatType" },
    dayType: { type: String, enum: DAY_TYPES },
    // The promotion weekday (0 = Sunday ... 6 = Saturday), for dayType "promo".
    weekday: { type: Number, min: 0, max: 6 },
    // Start-time window "HH:mm" (Vietnam time): both or neither.
    timeFrom: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    timeTo: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    // Whole dong.
    price: { type: Number, required: true, min: 0 },
    // Larger wins a tie that specificity and day type leave open.
    priority: { type: Number, required: true, default: 0, min: 0, max: 100 },
    validFrom: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    validTo: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

export type PriceRuleDoc = InferSchemaType<typeof priceRuleSchema>;

export const PriceRule: Model<PriceRuleDoc> =
  defineModel<PriceRuleDoc>("PriceRule", priceRuleSchema);
