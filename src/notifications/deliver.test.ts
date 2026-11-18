import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";
import type { PushOutcome, PushSender } from "./push";

describe("web push delivery", () => {
  let outbox: typeof import("./outbox");
  let deliver: typeof import("./deliver");
  let push: typeof import("@/services/push.service");
  let M: {
    User: typeof import("@/models/user").User;
    Notification: typeof import("@/models/notification").Notification;
    Delivery: typeof import("@/models/notification-delivery").NotificationDelivery;
    Sub: typeof import("@/models/push-subscription").PushSubscription;
  };
  let user: string;
  const payload = { appointmentId: "a1", movieTitle: "Phim", actorName: "An" };
  const keys = { p256dh: "k", auth: "a" };

  beforeAll(async () => {
    await startTestDatabase();
    outbox = await import("./outbox");
    deliver = await import("./deliver");
    push = await import("@/services/push.service");
    M = {
      User: (await import("@/models/user")).User,
      Notification: (await import("@/models/notification")).Notification,
      Delivery: (await import("@/models/notification-delivery")).NotificationDelivery,
      Sub: (await import("@/models/push-subscription")).PushSubscription,
    };
    await (await import("@/lib/db")).connectToDatabase();
    await M.Sub.init();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all(Object.values(M).map((m) => (m as { deleteMany(f: object): Promise<unknown> }).deleteMany({})));
    user = String((await M.User.create({ name: "An", username: "an", locale: "vi" }))._id);
  });

  const device = (n: number) => push.saveSubscription(user, { endpoint: `https://push.example/${n}`, keys });
  const queue = (type: "appointment_invited" | "appointment_cancelled" = "appointment_invited") => outbox.enqueueNotifications([{ recipientId: user, type, payload }]);
  const pending = () => M.Delivery.find({ channel: "webpush" }).lean();
  const sender = (outcome: (endpoint: string) => PushOutcome) => {
    const calls: { endpoint: string; title: string; body: string; url: string; ttlSeconds: number }[] = [];
    const fn: PushSender = async (target, message, options) => {
      calls.push({ endpoint: target.endpoint, ...message, ttlSeconds: options.ttlSeconds });
      return outcome(target.endpoint);
    };
    return { fn, calls };
  };

  describe("queueing", () => {
    it("queues a push only for people with a device that want this kind", async () => {
      await queue();
      expect(await pending()).toHaveLength(0); // no device
      await device(1);
      await queue();
      expect(await pending()).toHaveLength(1);
      await push.setPushPreference(user, "appointment_cancelled", false);
      await queue("appointment_cancelled");
      expect(await pending()).toHaveLength(1); // that kind is off: in-app only
      expect(await M.Notification.countDocuments({ type: "appointment_cancelled" })).toBe(1);
      await push.setPushPreference(user, "appointment_cancelled", true);
      await queue("appointment_cancelled");
      expect(await pending()).toHaveLength(2);
    });

    it("never queues for a locked account", async () => {
      await device(1);
      await M.User.updateOne({ _id: user }, { status: "locked" });
      await queue();
      expect(await pending()).toHaveLength(0);
    });
  });

  describe("sending", () => {
    it("sends the words in the person's language, with the pronoun pair, and marks it sent", async () => {
      await device(1);
      await queue();
      const { fn, calls } = sender(() => ({ status: "ok" }));
      expect(await deliver.processDeliveries({ sender: fn })).toBe(1);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ url: "/appointments/a1", title: expect.any(String) });
      expect(calls[0]?.body).toContain("An");
      expect(calls[0]?.body).toContain("Phim");
      expect(calls[0]?.body).not.toContain("[you]");
      expect((await pending())[0]).toMatchObject({ status: "sent" });
      // Nothing left: a second round does nothing.
      expect(await deliver.processDeliveries({ sender: fn })).toBe(0);
    });

    it("waits as long as the admin's setting says (24 hours by default)", async () => {
      await device(1);
      await queue();
      const first = sender(() => ({ status: "ok" }));
      await deliver.processDeliveries({ sender: first.fn });
      expect(first.calls[0]?.ttlSeconds).toBe(24 * 3600);

      const { SystemSetting } = await import("@/models/system-setting");
      await SystemSetting.updateOne({ key: "pushTtlHours" }, { $set: { value: 3 } }, { upsert: true });
      await queue();
      const second = sender(() => ({ status: "ok" }));
      await deliver.processDeliveries({ sender: second.fn });
      expect(second.calls[0]?.ttlSeconds).toBe(3 * 3600);
    });

    it("uses English for an English-speaking person", async () => {
      await M.User.updateOne({ _id: user }, { locale: "en" });
      await device(1);
      await queue();
      const { fn, calls } = sender(() => ({ status: "ok" }));
      await deliver.processDeliveries({ sender: fn });
      expect(calls[0]?.title).toBe("New plan!");
    });

    it("a gone device loses its subscription and the others still get it", async () => {
      await device(1);
      await device(2);
      await queue();
      const { fn, calls } = sender((endpoint) => (endpoint.endsWith("/1") ? { status: "gone" } : { status: "ok" }));
      await deliver.processDeliveries({ sender: fn });
      expect(calls).toHaveLength(2);
      expect((await M.Sub.find({}).lean()).map((s) => s.endpoint)).toEqual(["https://push.example/2"]);
      expect((await pending())[0]?.status).toBe("sent");
    });

    it("when every device is gone, it is done and nothing is retried", async () => {
      await device(1);
      await queue();
      await deliver.processDeliveries({ sender: sender(() => ({ status: "gone" })).fn });
      expect(await M.Sub.countDocuments()).toBe(0);
      expect((await pending())[0]?.status).toBe("sent");
    });

    it("a temporary failure retries later, up to 3 tries, then gives up", async () => {
      await device(1);
      await queue();
      const failing = sender(() => ({ status: "error", message: "http_500" }));
      const t0 = new Date();

      await deliver.processDeliveries({ sender: failing.fn, now: t0 });
      let row = (await pending())[0]!;
      expect([row.status, row.attempts]).toEqual(["pending", 1]);
      // Too early: not tried again.
      expect(await deliver.processDeliveries({ sender: failing.fn, now: new Date(t0.getTime() + 1000) })).toBe(0);

      await deliver.processDeliveries({ sender: failing.fn, now: new Date(t0.getTime() + 2 * 60_000) });
      row = (await pending())[0]!;
      expect([row.status, row.attempts]).toEqual(["pending", 2]);

      await deliver.processDeliveries({ sender: failing.fn, now: new Date(t0.getTime() + 10 * 60_000) });
      row = (await pending())[0]!;
      expect([row.status, row.attempts]).toEqual(["failed", 3]);
      expect(failing.calls).toHaveLength(3);
      expect(await deliver.processDeliveries({ sender: failing.fn, now: new Date(t0.getTime() + 60 * 60_000) })).toBe(0);
      // The device is kept: a temporary failure is not a reason to forget it.
      expect(await M.Sub.countDocuments()).toBe(1);
    });

    it("one device working and one failing counts as delivered (no second push to the one that worked)", async () => {
      await device(1);
      await device(2);
      await queue();
      const { fn, calls } = sender((endpoint) => (endpoint.endsWith("/1") ? { status: "ok" } : { status: "error", message: "http_500" }));
      await deliver.processDeliveries({ sender: fn });
      expect(calls).toHaveLength(2);
      expect((await pending())[0]?.status).toBe("sent");
    });

    it("two workers at once send each push exactly once", async () => {
      await device(1);
      for (let i = 0; i < 6; i++) await queue();
      const { fn, calls } = sender(() => ({ status: "ok" }));
      const [a, b] = await Promise.all([deliver.processDeliveries({ sender: fn }), deliver.processDeliveries({ sender: fn })]);
      expect(a + b).toBe(6);
      expect(calls).toHaveLength(6);
      expect((await pending()).every((d) => d.status === "sent")).toBe(true);
    });

    it("takes over a delivery whose worker died, but not one still being worked on", async () => {
      await device(1);
      await queue();
      const row = (await pending())[0]!;
      await M.Delivery.updateOne({ _id: row._id }, { $set: { status: "processing", attempts: 1 } });
      const { fn, calls } = sender(() => ({ status: "ok" }));
      expect(await deliver.processDeliveries({ sender: fn })).toBe(0); // fresh: another worker has it
      expect(await deliver.processDeliveries({ sender: fn, now: new Date(Date.now() + 5 * 60_000) })).toBe(1);
      expect(calls).toHaveLength(1);
    });
  });

  describe("devices", () => {
    it("lists, replaces on the same browser, and only the owner can remove", async () => {
      await device(1);
      await device(1);
      const other = String(new Types.ObjectId());
      expect(await push.listDevices(user)).toHaveLength(1);
      const [d] = await push.listDevices(user);
      expect(await push.removeDevice(other, d!.id)).toBe(false);
      expect(await push.removeDevice(user, d!.id)).toBe(true);
      expect(await push.listDevices(user)).toHaveLength(0);
    });

    it("the same browser used by another person moves to them", async () => {
      await device(1);
      const other = String((await M.User.create({ name: "B", username: "b" }))._id);
      await push.saveSubscription(other, { endpoint: "https://push.example/1", keys });
      expect(await push.listDevices(user)).toHaveLength(0);
      expect(await push.listDevices(other)).toHaveLength(1);
    });

    it("rejects an endpoint that is not https", () => {
      expect(push.subscriptionSchema.safeParse({ endpoint: "http://x.example/1", keys }).success).toBe(false);
      expect(push.subscriptionSchema.safeParse({ endpoint: "https://x.example/1", keys }).success).toBe(true);
    });

    it("a test push reaches every device and cleans up the gone ones", async () => {
      await device(1);
      await device(2);
      const { fn } = sender((endpoint) => (endpoint.endsWith("/2") ? { status: "gone" } : { status: "ok" }));
      expect(await push.sendTestPush(user, { title: "t", body: "b", url: "/" }, fn, { ttlSeconds: 60 })).toEqual({ sent: 1, failed: 0, removed: 1, errors: [] });
      expect(await push.listDevices(user)).toHaveLength(1);
    });
  });
});
