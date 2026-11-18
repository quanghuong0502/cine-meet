import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

// One row per browser/device that turned Web Push on. The endpoint is unique: subscribing again from the same browser replaces the row.
const pushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "" },
    lastUsedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type PushSubscriptionDoc = InferSchemaType<typeof pushSubscriptionSchema>;

export const PushSubscription: Model<PushSubscriptionDoc> =
  (models.PushSubscription as Model<PushSubscriptionDoc> | undefined) ?? model<PushSubscriptionDoc>("PushSubscription", pushSubscriptionSchema);
