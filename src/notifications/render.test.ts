import { describe, expect, it } from "vitest";
import { notificationKey, renderNotification } from "./render";

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

  it("other types use their own name", () => {
    expect(notificationKey("appointment_invited", base)).toBe("appointment_invited");
    expect(notificationKey("participant_withdrew", base)).toBe("participant_withdrew");
  });
});
