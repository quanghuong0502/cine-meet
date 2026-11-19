import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
import { EXPENSE_CATEGORIES } from "@/lib/appointment/cost";

/** What a viewing cost one person, by category (design 5). The only source for the dashboard. Whole dong; no payer, no debt. */
const expenseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Missing for a viewing that was not planned in the app (Sprint 6).
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    // Why a person changed their own amount.
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ appointmentId: 1, userId: 1, category: 1 }, { unique: true, partialFilterExpression: { appointmentId: { $exists: true } } });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema>;

export const Expense: Model<ExpenseDoc> =
  defineModel<ExpenseDoc>("Expense", expenseSchema);
