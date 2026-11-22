import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

// One row per browser/device that turned push on through OneSignal. The subscription id is OneSignal's own, unique per device:
// subscribing again from the same browser (even after another person signed in on it) replaces the owner, like a Web Push endpoint.
// Kept apart from `pushSubscriptions` so switching PUSH_PROVIDER back to Web Push finds those rows exactly as they were.
const oneSignalDeviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subscriptionId: { type: String, required: true, unique: true },
    userAgent: { type: String, default: "" },
    lastUsedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type OneSignalDeviceDoc = InferSchemaType<typeof oneSignalDeviceSchema>;

export const OneSignalDevice: Model<OneSignalDeviceDoc> = defineModel<OneSignalDeviceDoc>("OneSignalDevice", oneSignalDeviceSchema);
