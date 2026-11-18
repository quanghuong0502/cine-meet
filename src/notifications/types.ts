/** Events the app tells people about (design 4.1). The number is the row in the design table. */
export const NOTIFICATION_TYPES = [
  "appointment_invited", // #1  someone invited me
  "appointment_reply", //   #2  someone agreed, declined or suggested another time
  "participants_locked", // #4  the creator locked the list
  "appointment_cancelled", // #7  the creator cancelled
  "participant_withdrew", // #13 an attendee left
  "poll_reminder", //         the creator nudges people who have not voted on a time
  "friend_request", //        someone asked me to be friends
  "friend_accepted", //       someone said yes to my friend request
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

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
  /** For `participants_locked`: false when the recipient was left out. */
  included?: boolean;
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
