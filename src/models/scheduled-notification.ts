import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

/** Design 4.3: a time-based notification that has not happened yet (a reminder before showtime, a deadline warning, an expense nudge). */
export const SCHEDULED_NOTIFICATION_TYPES = ["reminder", "deadline_warning", "expense_reminder"] as const;
export type ScheduledNotificationType = (typeof SCHEDULED_NOTIFICATION_TYPES)[number];

export const SCHEDULED_NOTIFICATION_STATUSES = ["pending", "processing", "sent", "cancelled"] as const;
export type ScheduledNotificationStatus = (typeof SCHEDULED_NOTIFICATION_STATUSES)[number];

const scheduledNotificationSchema = new Schema(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
    type: { type: String, enum: SCHEDULED_NOTIFICATION_TYPES, required: true },
    // Only for "reminder": which of the admin's `reminderMinutesBefore` values this row is for. Lets a changed list cancel exactly
    // the old rows (by value) and add the new ones, instead of guessing which row is which.
    minutesBefore: { type: Number },
    sendAt: { type: Date, required: true },
    status: { type: String, enum: SCHEDULED_NOTIFICATION_STATUSES, default: "pending", required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

scheduledNotificationSchema.index({ status: 1, sendAt: 1 });
scheduledNotificationSchema.index({ appointmentId: 1, type: 1 });

export type ScheduledNotificationDoc = InferSchemaType<typeof scheduledNotificationSchema>;

export const ScheduledNotification: Model<ScheduledNotificationDoc> = defineModel<ScheduledNotificationDoc>(
  "ScheduledNotification",
  scheduledNotificationSchema,
);
