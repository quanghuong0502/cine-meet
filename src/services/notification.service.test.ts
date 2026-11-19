import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("notification outbox and list", () => {
  let svc: typeof import("./notification.service");
  let outbox: typeof import("@/notifications/outbox");
  let Notification: typeof import("@/models/notification").Notification;
  let Delivery: typeof import("@/models/notification-delivery").NotificationDelivery;
  const me = new Types.ObjectId().toString();
  const other = new Types.ObjectId().toString();
  const payload = { appointmentId: "a1", movieTitle: "Phim", actorName: "An" };

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./notification.service");
    outbox = await import("@/notifications/outbox");
    Notification = (await import("@/models/notification")).Notification;
    Delivery = (await import("@/models/notification-delivery")).NotificationDelivery;
    await (await import("@/lib/db")).connectToDatabase();
  }, 120_000);
  afterAll(stopTestDatabase);
  beforeEach(async () => {
    await Promise.all([Notification.deleteMany({}), Delivery.deleteMany({})]);
  });

  it("writes the in-app message as already sent", async () => {
    await outbox.enqueueNotifications([{ recipientId: me, type: "appointment_invited", payload }]);
    const deliveries = await Delivery.find({}).lean();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ channel: "inapp", status: "sent" });
  });

  it("lists only the person's own, newest first, and counts the unread", async () => {
    await outbox.enqueueNotifications([{ recipientId: me, type: "appointment_invited", payload }]);
    await outbox.enqueueNotifications([{ recipientId: other, type: "appointment_invited", payload }]);
    await outbox.enqueueNotifications([{ recipientId: me, type: "appointment_cancelled", payload }]);
    const list = await svc.listNotifications(me);
    expect(list.map((n) => n.type)).toEqual(["appointment_cancelled", "appointment_invited"]);
    expect(await svc.countUnread(me)).toBe(2);
    expect(await svc.countUnread(other)).toBe(1);
  });

  it("marks one read (only your own), then all", async () => {
    await outbox.enqueueNotifications([
      { recipientId: me, type: "appointment_invited", payload },
      { recipientId: me, type: "appointment_cancelled", payload },
      { recipientId: other, type: "appointment_invited", payload },
    ]);
    const [first] = await svc.listNotifications(me);
    const theirs = (await svc.listNotifications(other))[0]!;
    expect(await svc.markRead(me, theirs.id)).toBe(false);
    expect(await svc.markRead(me, first!.id)).toBe(true);
    expect(await svc.markRead(me, first!.id)).toBe(false);
    expect(await svc.countUnread(me)).toBe(1);
    expect(await svc.markAllRead(me)).toBe(1);
    expect(await svc.countUnread(me)).toBe(0);
    expect(await svc.countUnread(other)).toBe(1);
    expect(await svc.markRead(me, "nope")).toBe(false);
  });

  it("does not throw when it cannot write (the appointment must still go through)", async () => {
    await expect(outbox.enqueueNotifications([{ recipientId: "not-an-id", type: "appointment_invited", payload }])).resolves.toBeUndefined();
  });
});
