import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** Design 4.3: a time-based notification that has not happened yet (a reminder before showtime, a deadline warning, an expense nudge). */
export const SCHEDULED_NOTIFICATION_TYPES = ["reminder", "deadline_warning", "expense_reminder"] as const;
export type ScheduledNotificationType = (typeof SCHEDULED_NOTIFICATION_TYPES)[number];

export const SCHEDULED_NOTIFICATION_STATUSES = ["pending", "processing", "sent", "cancelled"] as const;
export type ScheduledNotificationStatus = (typeof SCHEDULED_NOTIFICATION_STATUSES)[number];

const scheduledNotificationSchema = new Schema(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
    type: { type: String, enum: SCHEDULED_NOTIFICATION_TYPES, required: true },
    // Only for "reminder": which of the admin's `reminderMinutesBefore` values this row is for. Lets a changed list cancel exactly
    // the old rows (by value) and add the new ones, instead of guessing which row is which.
    minutesBefore: { type: Number },
    sendAt: { type: Date, required: true },
    // With PUSH_PROVIDER=onesignal: the push of each person was handed to OneSignal ahead of time, held until `sendAt` (their message id
    // is what a cancel needs). Empty: nothing is held there and the push goes out when the sweep finds this row due (Web Push, or no OneSignal).
    pushIds: {
      type: [{ _id: false, userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, id: { type: String, required: true } }],
      default: [],
    },
    status: { type: String, enum: SCHEDULED_NOTIFICATION_STATUSES, default: "pending", required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

scheduledNotificationSchema.index({ status: 1, sendAt: 1 });
scheduledNotificationSchema.index({ status: 1, updatedAt: 1 });
scheduledNotificationSchema.index({ appointmentId: 1, status: 1, type: 1 });
scheduledNotificationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 3600, partialFilterExpression: { status: { $in: ["sent", "cancelled"] } } },
);

export type ScheduledNotificationDoc = InferSchemaType<typeof scheduledNotificationSchema>;

export const ScheduledNotification: Model<ScheduledNotificationDoc> = defineModel<ScheduledNotificationDoc>(
  "ScheduledNotification",
  scheduledNotificationSchema,
);
