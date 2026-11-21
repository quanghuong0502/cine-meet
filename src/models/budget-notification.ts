import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/**
 * Marks that a person has already been told (#11) they reached a budget threshold this month, for one category. Exists only
 * to stop the same crossing being announced again on every later expense; the budget numbers themselves live on `users`.
 */
const budgetNotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Vietnam calendar month, "YYYY-MM".
    month: { type: String, required: true },
    category: { type: String, enum: ["ticket", "fnb"], required: true },
    threshold: { type: Number, enum: [80, 100], required: true },
  },
  { timestamps: true },
);

budgetNotificationSchema.index({ userId: 1, month: 1, category: 1, threshold: 1 }, { unique: true });

export type BudgetNotificationDoc = InferSchemaType<typeof budgetNotificationSchema>;

export const BudgetNotification: Model<BudgetNotificationDoc> =
  defineModel<BudgetNotificationDoc>("BudgetNotification", budgetNotificationSchema);
