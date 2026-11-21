import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { applyPronouns, DEFAULT_PRONOUNS } from "@/lib/pronouns";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import { notificationKey, renderNotification } from "./render";
import { NOTIFICATION_TYPES, type NotificationPayload, type NotificationType } from "./types";

const base = { appointmentId: "a", movieTitle: "M", actorName: "An" };
const friend = { actorName: "An" };

describe("notificationKey", () => {
  it("separates replies by what the person did, and declines by whether they gave a reason", () => {
    expect(notificationKey("appointment_reply", { ...base, kind: "agree" })).toBe("appointment_reply.agree");
    expect(notificationKey("appointment_reply", { ...base, kind: "propose" })).toBe("appointment_reply.propose");
    expect(notificationKey("appointment_reply", { ...base, kind: "decline" })).toBe("appointment_reply.decline");
    expect(notificationKey("appointment_reply", { ...base, kind: "decline", reason: "bận" })).toBe("appointment_reply.declineReason");
  });
  it("tells someone who was left out differently", () => {
    expect(notificationKey("participants_locked", { ...base, included: true })).toBe("participants_locked.included");
    expect(notificationKey("participants_locked", { ...base, included: false })).toBe("participants_locked.excluded");
  });
  it("a cancel reason has its own wording", () => {
    expect(notificationKey("appointment_cancelled", base)).toBe("appointment_cancelled.plain");
    expect(notificationKey("appointment_cancelled", { ...base, reason: "x" })).toBe("appointment_cancelled.reason");
  });
  it("friend news has its own wording and opens the Friends screen", () => {
    expect(notificationKey("friend_request", friend)).toBe("friend_request");
    expect(notificationKey("friend_accepted", friend)).toBe("friend_accepted");
    const t = (key: string, values?: Record<string, string>) => `${key}|${values?.actorName}`;
    expect(renderNotification(t, "friend_request", friend)).toEqual({ title: "friend_request.title|An", body: "friend_request.body|An", url: "/friends" });
    expect(renderNotification(t, "appointment_invited", base).url).toBe("/appointments/a");
  });

  it("a vote reminder writes the time in the receiver's language", () => {
    const t = (key: string, values?: Record<string, string>) => `${key}|${values?.time}`;
    const slot = { ...base, slotAt: "2099-12-05T12:30:00Z" };
    const vi = renderNotification(t, "poll_reminder", slot, "vi");
    const en = renderNotification(t, "poll_reminder", slot, "en");
    expect(vi.body).toContain("19:30");
    expect(vi.body).toContain("05/12");
    expect(en.body).toContain("19:30");
    expect(vi.url).toBe("/appointments/a");
  });

  it("other types use their own name", () => {
    expect(notificationKey("appointment_invited", base)).toBe("appointment_invited");
    expect(notificationKey("participant_withdrew", base)).toBe("participant_withdrew");
  });

  it("a budget warning picks the wording by how much of the budget was reached, and opens the dashboard", () => {
    expect(notificationKey("budget_warning", { actorName: "", percent: 80 })).toBe("budget_warning.eighty");
    expect(notificationKey("budget_warning", { actorName: "", percent: 100 })).toBe("budget_warning.full");
    const t = (key: string, values?: Record<string, string>) => `${key}|${values?.budgetCategory ?? ""}`;
    const rendered = renderNotification(t, "budget_warning", { actorName: "", percent: 80, budgetCategory: "ticket" });
    expect(rendered).toEqual({ title: "budget_warning.eighty.title|budgetCategories.ticket|", body: "budget_warning.eighty.body|budgetCategories.ticket|", url: "/" });
  });

  it("an expense reminder opens the appointment to log cost and rate (#9, step 7.2)", () => {
    const t = (key: string) => key;
    const rendered = renderNotification(t, "expense_reminder", { appointmentId: "appt-999", actorName: "", movieTitle: "Avatar" });
    expect(rendered.url).toBe("/appointments/appt-999");
  });

  it("every notification type actually resolves to real words, in both languages (catches a key typo or a missing message)", () => {
    const payloads: Record<NotificationType, NotificationPayload> = {
      appointment_invited: { ...base },
      appointment_reply: { ...base, kind: "agree" },
      participants_locked: { ...base, included: true },
      appointment_cancelled: { ...base },
      participant_withdrew: { ...base },
      appointment_confirmed: { ...base, slotAt: "2099-01-01T12:00:00Z", place: "P", seatCode: "A1" },
      appointment_changed: { ...base, change: "seat", seatCode: "A1" },
      poll_reminder: { ...base, slotAt: "2099-01-01T12:00:00Z" },
      friend_request: { actorName: "An" },
      friend_accepted: { actorName: "An" },
      response_deadline_warning: { ...base, slotAt: "2099-01-01T12:00:00Z" },
      showtime_reminder: { ...base, slotAt: "2099-01-01T12:00:00Z", place: "P", seatCode: "A1" },
      expense_reminder: { ...base },
      budget_warning: { actorName: "", percent: 80, budgetCategory: "ticket" },
    };
    for (const locale of ["vi", "en"] as const) {
      const messages = locale === "vi" ? applyPronouns(vi, DEFAULT_PRONOUNS) : en;
      const t = createTranslator({ locale, messages: messages as never, namespace: "notifications.types" as never }) as unknown as (key: string, values?: Record<string, string>) => string;
      for (const type of NOTIFICATION_TYPES) {
        const rendered = renderNotification(t, type, payloads[type], locale);
        expect(rendered.title, `${locale}/${type} title`).not.toMatch(/MISSING_MESSAGE|undefined/);
        expect(rendered.body, `${locale}/${type} body`).not.toMatch(/MISSING_MESSAGE|undefined/);
      }
    }
  });
});
