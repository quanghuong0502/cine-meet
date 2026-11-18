import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { DELIVERY_STATUSES, NOTIFICATION_CHANNELS } from "@/notifications/types";

// How one notification travels on one channel. `inapp` is written already `sent` (the row itself is the in-app message);
// `webpush` starts `pending` and the worker claims it.
const deliverySchema = new Schema(
  {
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification", required: true, index: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    status: { type: String, enum: DELIVERY_STATUSES, default: "pending", required: true },
    attempts: { type: Number, default: 0 },
    // When the worker may try next (a retry waits a little).
    nextAttemptAt: { type: Date, default: () => new Date() },
    error: { type: String },
  },
  { timestamps: true },
);

deliverySchema.index({ channel: 1, status: 1, nextAttemptAt: 1 });
// Old finished rows clean themselves up after 30 days.
deliverySchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600, partialFilterExpression: { status: { $in: ["sent", "failed"] } } });

export type DeliveryDoc = InferSchemaType<typeof deliverySchema>;

export const NotificationDelivery: Model<DeliveryDoc> =
  (models.NotificationDelivery as Model<DeliveryDoc> | undefined) ?? model<DeliveryDoc>("NotificationDelivery", deliverySchema);
