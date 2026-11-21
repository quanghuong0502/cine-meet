/** Events the app tells people about (design 4.1). The number is the row in the design table. */
export const NOTIFICATION_TYPES = [
  "appointment_invited", // #1  someone invited me
  "appointment_reply", //   #2  someone agreed, declined or suggested another time
  "participants_locked", // #4  the creator locked the list
  "appointment_cancelled", // #7  the creator cancelled
  "participant_withdrew", // #13 an attendee left
  "appointment_confirmed", // #5  the plan is confirmed: movie, time, place, my seat
  "appointment_changed", //   #6  seat or time changed after confirming
  "poll_reminder", //         the creator nudges people who have not voted on a time
  "friend_request", //        someone asked me to be friends
  "friend_accepted", //       someone said yes to my friend request
  "response_deadline_warning", // #3  12h left to answer, for people who have not
  "showtime_reminder", //     #8  N minutes before the showtime (admin's reminderMinutesBefore)
  "expense_reminder", //      #9  nudge to log real cost and rate the seat, ~3h after the showtime
  "budget_warning", //        #11 this month's spending reached 80% or 100% of the person's budget
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** How the notification settings group the kinds, so each switch is read in context. Every kind is in exactly one group (a test checks). */
export const NOTIFICATION_GROUPS = [
  {
    id: "appointments",
    types: ["appointment_invited", "appointment_reply", "poll_reminder", "participants_locked", "appointment_confirmed", "appointment_changed", "appointment_cancelled", "participant_withdrew"],
  },
  { id: "reminders", types: ["response_deadline_warning", "showtime_reminder", "expense_reminder"] },
  { id: "friends", types: ["friend_request", "friend_accepted"] },
  { id: "budget", types: ["budget_warning"] },
] as const satisfies readonly { id: string; types: readonly NotificationType[] }[];

export const REPLY_KINDS = ["agree", "decline", "propose"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];

/**
 * What is stored with a notification: ids and plain facts, never sentences. The words are made when the notification is shown
 * (or pushed), in the language of the person who gets it.
 */
export interface NotificationPayload {
  /** The appointment this is about; friend notifications have none. */
  appointmentId?: string;
  movieTitle?: string;
  /** Who did it. */
  actorName: string;
  /** For `appointment_reply`. */
  kind?: ReplyKind;
  /** Decline or cancel reason the person typed. */
  reason?: string;
  /** For `poll_reminder`: the time being voted on (ISO). */
  slotAt?: string;
  /** For `appointment_confirmed` and `appointment_changed`: the recipient's seat (or none) and where it is. */
  seatCode?: string;
  place?: string;
  /** For `appointment_changed`: what changed. */
  change?: "seat" | "time";
  /** For `participants_locked`: false when the recipient was left out. */
  included?: boolean;
  /** For `budget_warning`: which budget (ticket or fnb) and how much of it (80 or 100). */
  budgetCategory?: "ticket" | "fnb";
  percent?: number;
}

export interface NotificationInput {
  recipientId: string;
  type: NotificationType;
  payload: NotificationPayload;
}

export const NOTIFICATION_CHANNELS = ["inapp", "webpush"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DELIVERY_STATUSES = ["pending", "processing", "sent", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const MAX_DELIVERY_ATTEMPTS = 3;
