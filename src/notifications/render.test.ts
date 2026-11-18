import { describe, expect, it } from "vitest";
import { notificationKey } from "./render";

const base = { appointmentId: "a", movieTitle: "M", actorName: "An" };

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
  it("other types use their own name", () => {
    expect(notificationKey("appointment_invited", base)).toBe("appointment_invited");
    expect(notificationKey("participant_withdrew", base)).toBe("participant_withdrew");
  });
});
