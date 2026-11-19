import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
import { NOTIFICATION_TYPES } from "@/notifications/types";

// The outbox: one row per event per person. In-app shows these rows directly; Web Push reads their deliveries.
const notificationSchema = new Schema(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationDoc> =
  defineModel<NotificationDoc>("Notification", notificationSchema);
