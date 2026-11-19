import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** One system-wide setting (design 2.7): a stable key and its value. Defaults live in code, so a missing row is fine. */
const systemSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export type SystemSettingDoc = InferSchemaType<typeof systemSettingSchema>;

export const SystemSetting: Model<SystemSettingDoc> =
  defineModel<SystemSettingDoc>("SystemSetting", systemSettingSchema);
