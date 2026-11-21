import { formatDayCompact, formatTime } from "@/lib/datetime";
import type { NotificationPayload, NotificationType } from "./types";

/** What a notification says, as plain strings: used for the in-app list and for the push. */
export interface RenderedNotification {
  title: string;
  body: string;
  /** Where tapping it goes (an app path). */
  url: string;
}

type Translate = (key: string, values?: Record<string, string>) => string;

/**
 * The key (under `notifications.types`) that says what happened, picked from the type and what the payload carries:
 * the same event can read differently (a reason was given, the person was left out of the list).
 */
export function notificationKey(type: NotificationType, payload: NotificationPayload): string {
  switch (type) {
    case "appointment_reply":
      if (payload.kind === "decline") return payload.reason ? "appointment_reply.declineReason" : "appointment_reply.decline";
      return `appointment_reply.${payload.kind ?? "agree"}`;
    case "participants_locked":
      return payload.included === false ? "participants_locked.excluded" : "participants_locked.included";
    case "appointment_cancelled":
      return payload.reason ? "appointment_cancelled.reason" : "appointment_cancelled.plain";
    case "appointment_changed":
      if (payload.change === "time") return "appointment_changed.time";
      return payload.seatCode ? "appointment_changed.seat" : "appointment_changed.seatNone";
    case "budget_warning":
      return payload.percent === 100 ? "budget_warning.full" : "budget_warning.eighty";
    default:
      return type;
  }
}

/** `t` is a translator scoped to `notifications.types` (title and body live under each key). */
export function renderNotification(t: Translate, type: NotificationType, payload: NotificationPayload, locale = "vi"): RenderedNotification {
  const key = notificationKey(type, payload);
  // A time is written out here, in the language of the person it is for.
  const time = payload.slotAt ? `${formatDayCompact(payload.slotAt, locale, new Date(), { midSentence: true })} · ${formatTime(payload.slotAt, locale)}` : "";
  const budgetCategory = payload.budgetCategory ? t(`budgetCategories.${payload.budgetCategory}`) : "";
  const values = { actorName: payload.actorName, movieTitle: payload.movieTitle ?? "", reason: payload.reason ?? "", time, seatCode: payload.seatCode ?? "", place: payload.place ?? "", budgetCategory };
  // Appointment news opens that appointment; friend news opens Friends; a budget warning opens the dashboard.
  const url = payload.appointmentId ? `/appointments/${payload.appointmentId}` : type === "budget_warning" ? "/" : "/friends";
  return { title: t(`${key}.title`, values), body: t(`${key}.body`, values), url };
}
