import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";
import type { OneSignalResult, OneSignalSender } from "./onesignal";
import type { PushSender } from "./push";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("push delivery through OneSignal", () => {
  let outbox: typeof import("./outbox");
  let deliver: typeof import("./deliver");
  let push: typeof import("@/services/push.service");
  let M: {
    User: typeof import("@/models/user").User;
    Notification: typeof import("@/models/notification").Notification;
    Delivery: typeof import("@/models/notification-delivery").NotificationDelivery;
    Device: typeof import("@/models/onesignal-device").OneSignalDevice;
    Sub: typeof import("@/models/push-subscription").PushSubscription;
  };
  let user: string;
  const payload = { appointmentId: "a1", movieTitle: "Phim", actorName: "An" };
  const never: PushSender = async () => {
    throw new Error("the Web Push sender must not be used with OneSignal");
  };

  beforeAll(async () => {
    await startTestDatabase();
    outbox = await import("./outbox");
    deliver = await import("./deliver");
    push = await import("@/services/push.service");
    M = {
      User: (await import("@/models/user")).User,
      Notification: (await import("@/models/notification")).Notification,
      Delivery: (await import("@/models/notification-delivery")).NotificationDelivery,
      Device: (await import("@/models/onesignal-device")).OneSignalDevice,
      Sub: (await import("@/models/push-subscription")).PushSubscription,
    };
    await (await import("@/lib/db")).connectToDatabase();
    await M.Device.init();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    vi.stubEnv("PUSH_PROVIDER", "onesignal");
    await Promise.all(Object.values(M).map((m) => (m as { deleteMany(f: object): Promise<unknown> }).deleteMany({})));
    user = String((await M.User.create({ name: "An", username: "an", locale: "vi" }))._id);
  });
  afterEach(() => vi.unstubAllEnvs());

  const device = (id: string) => push.saveOneSignalDevice(user, { subscriptionId: id, userAgent: "iPhone" });
  const queue = () => outbox.enqueueNotifications([{ recipientId: user, type: "appointment_invited", payload }]);
  const delivery = () => M.Delivery.findOne({ channel: "webpush" }).lean();
  const sender = (result: OneSignalResult | ((ids: string[]) => OneSignalResult)) => {
    const calls: { ids: string[]; title: string; body: string; url: string; ttlSeconds: number }[] = [];
    const fn: OneSignalSender = async (ids, message, options) => {
      calls.push({ ids, ...message, ttlSeconds: options.ttlSeconds });
      return typeof result === "function" ? result(ids) : result;
    };
    return { fn, calls };
  };
  const run = (oneSignal: OneSignalSender, now = new Date()) => deliver.processDeliveries({ sender: never, oneSignal, now });

  it("queues a push only for people with a OneSignal device (a Web Push device does not count)", async () => {
    await queue();
    expect(await M.Delivery.countDocuments({ channel: "webpush" })).toBe(0);
    await M.Sub.create({ userId: user, endpoint: "https://push.example/1", keys: { p256dh: "k", auth: "a" } });
    await queue();
    expect(await M.Delivery.countDocuments({ channel: "webpush" })).toBe(0);
    await device(A);
    await queue();
    expect(await M.Delivery.countDocuments({ channel: "webpush" })).toBe(1);
  });

  it("sends once for all devices, in the person's language, and marks it sent", async () => {
    await device(A);
    await device(B);
    await queue();
    const { fn, calls } = sender({ status: "ok", id: "m1", invalidIds: [] });
    expect(await run(fn)).toBe(1);
    expect(calls).toHaveLength(1);
    expect([...(calls[0]?.ids ?? [])].sort()).toEqual([A, B]);
    expect(calls[0]).toMatchObject({ url: "/appointments/a1" });
    expect(calls[0]?.body).toContain("An");
    expect(calls[0]?.body).not.toContain("[you]");
    expect(await delivery()).toMatchObject({ status: "sent" });
    expect((await M.Device.findOne({ subscriptionId: A }).lean())?.lastUsedAt).toBeInstanceOf(Date);
    expect(await run(fn)).toBe(0);
  });

  it("drops devices OneSignal says are gone, keeps the others, and still counts it as sent", async () => {
    await device(A);
    await device(B);
    await queue();
    const { fn } = sender({ status: "ok", id: "m1", invalidIds: [B] });
    await run(fn);
    expect(await M.Device.countDocuments({ subscriptionId: B })).toBe(0);
    expect(await M.Device.countDocuments({ subscriptionId: A })).toBe(1);
    expect(await delivery()).toMatchObject({ status: "sent" });
  });

  it("is done, not retried, when every device is gone", async () => {
    await device(A);
    await queue();
    const { fn } = sender({ status: "ok", id: "", invalidIds: [A] });
    await run(fn);
    expect(await M.Device.countDocuments({})).toBe(0);
    expect(await delivery()).toMatchObject({ status: "sent" });
  });

  it("does nothing when the person turned push off since it was queued", async () => {
    await device(A);
    await queue();
    await M.Device.deleteMany({});
    const { fn, calls } = sender({ status: "ok", id: "m1", invalidIds: [] });
    await run(fn);
    expect(calls).toHaveLength(0);
    expect(await delivery()).toMatchObject({ status: "sent", error: "no_subscription" });
  });

  it("never sends to a locked account", async () => {
    await device(A);
    await queue();
    await M.User.updateOne({ _id: user }, { status: "locked" });
    const { fn, calls } = sender({ status: "ok", id: "m1", invalidIds: [] });
    await run(fn);
    expect(calls).toHaveLength(0);
    expect(await delivery()).toMatchObject({ status: "sent", error: "recipient_unavailable" });
  });

  it("retries a temporary failure after a wait (1 minute, then 5), then gives up after the third try", async () => {
    await device(A);
    await queue();
    const { fn, calls } = sender({ status: "error", message: "http_503", invalidIds: [], retry: true });
    const t0 = new Date();
    await run(fn, t0);
    expect(await delivery()).toMatchObject({ status: "pending", attempts: 1, error: "http_503" });
    // Too early for the second try.
    expect(await run(fn, new Date(t0.getTime() + 30_000))).toBe(0);
    await run(fn, new Date(t0.getTime() + 61_000));
    expect(await delivery()).toMatchObject({ status: "pending", attempts: 2 });
    await run(fn, new Date(t0.getTime() + 61_000 + 5 * 60_000 + 1000));
    expect(await delivery()).toMatchObject({ status: "failed", attempts: 3, error: "http_503" });
    expect(calls).toHaveLength(3);
  });

  it("fails at once on a refusal that waiting will not fix", async () => {
    await device(A);
    await queue();
    const { fn, calls } = sender({ status: "error", message: "http_400", invalidIds: [], retry: false });
    await run(fn);
    expect(await delivery()).toMatchObject({ status: "failed", error: "http_400" });
    expect(calls).toHaveLength(1);
  });

  it("fails without a OneSignal sender instead of dropping the push silently", async () => {
    await device(A);
    await queue();
    await deliver.processDeliveries({ sender: never });
    expect(await delivery()).toMatchObject({ status: "failed", error: "not_configured" });
  });

  describe("devices", () => {
    const Device = () => M.Device;
    const User = () => M.User;

    it("accepts only a OneSignal subscription id (a UUID)", () => {
      expect(push.oneSignalDeviceSchema.safeParse({ subscriptionId: A }).success).toBe(true);
      expect(push.oneSignalDeviceSchema.safeParse({ subscriptionId: "not-an-id" }).success).toBe(false);
      expect(push.oneSignalDeviceSchema.safeParse({ subscriptionId: "" }).success).toBe(false);
    });

    it("moves a device to whoever turns push on from it last, and lists and removes only the person's own", async () => {
      const other = String((await User().create({ name: "Bình", username: "binh", locale: "vi" }))._id);
      await push.saveOneSignalDevice(user, { subscriptionId: A, userAgent: "iPhone" });
      await push.saveOneSignalDevice(other, { subscriptionId: A, userAgent: "iPhone" });
      expect(await push.listDevices(user)).toHaveLength(0);
      const mine = await push.listDevices(other);
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ endpoint: A, device: "iphone" });
      expect(await push.removeDevice(user, mine[0]!.id)).toBe(false);
      expect(await push.removeDevice(other, mine[0]!.id)).toBe(true);
      expect(await Device().countDocuments({})).toBe(0);
    });

    it("sends a test through OneSignal and drops the ids it says are gone", async () => {
      await push.saveOneSignalDevice(user, { subscriptionId: A });
      await push.saveOneSignalDevice(user, { subscriptionId: B });
      const ok = await push.sendTestOneSignal(user, { title: "t", body: "b", url: "/settings" }, async () => ({ status: "ok", id: "m", invalidIds: [B] }), { ttlSeconds: 60 });
      expect(ok).toMatchObject({ sent: 1, failed: 0, removed: 1 });
      expect(await Device().countDocuments({})).toBe(1);
      const failed = await push.sendTestOneSignal(user, { title: "t", body: "b", url: "/settings" }, async () => ({ status: "error", message: "http_500", invalidIds: [], retry: true }), { ttlSeconds: 60 });
      expect(failed).toMatchObject({ sent: 0, failed: 1, errors: ["http_500"] });
    });
  });
});
