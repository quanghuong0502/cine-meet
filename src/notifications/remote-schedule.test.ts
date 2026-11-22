import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("scheduled pushes held at OneSignal", () => {
  let svc: typeof import("@/services/scheduled-notification.service");
  let scheduler: typeof import("./scheduler");
  let push: typeof import("@/services/push.service");
  let M: {
    Appointment: typeof import("@/models/appointment").Appointment;
    Scheduled: typeof import("@/models/scheduled-notification").ScheduledNotification;
    Notification: typeof import("@/models/notification").Notification;
    Delivery: typeof import("@/models/notification-delivery").NotificationDelivery;
    Device: typeof import("@/models/onesignal-device").OneSignalDevice;
    Movie: typeof import("@/models/movie").Movie;
    Showtime: typeof import("@/models/showtime").Showtime;
    User: typeof import("@/models/user").User;
    Setting: typeof import("@/models/system-setting").SystemSetting;
  };
  const oid = () => new mongoose.Types.ObjectId();
  // Real clock: the code under test decides "is this in the future" with the current time.
  const hours = (h: number) => new Date(Date.now() + h * 3600_000);

  let calls: { method: string; url: string; body?: Record<string, unknown> }[];
  let failPosts = false;

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("@/services/scheduled-notification.service");
    scheduler = await import("./scheduler");
    push = await import("@/services/push.service");
    M = {
      Appointment: (await import("@/models/appointment")).Appointment,
      Scheduled: (await import("@/models/scheduled-notification")).ScheduledNotification,
      Notification: (await import("@/models/notification")).Notification,
      Delivery: (await import("@/models/notification-delivery")).NotificationDelivery,
      Device: (await import("@/models/onesignal-device")).OneSignalDevice,
      Movie: (await import("@/models/movie")).Movie,
      Showtime: (await import("@/models/showtime")).Showtime,
      User: (await import("@/models/user")).User,
      Setting: (await import("@/models/system-setting")).SystemSetting,
    };
    await (await import("@/lib/db")).connectToDatabase();
    await M.Device.init();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    vi.stubEnv("PUSH_PROVIDER", "onesignal");
    vi.stubEnv("ONESIGNAL_APP_ID", "app-1");
    vi.stubEnv("ONESIGNAL_API_KEY", "key-1");
    await Promise.all(Object.values(M).map((m) => (m as { deleteMany(f: object): Promise<unknown> }).deleteMany({})));
    calls = [];
    failPosts = false;
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
        const method = init?.method ?? "GET";
        calls.push({ method, url, body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined });
        if (method === "POST" && failPosts) throw new Error("offline");
        return new Response(JSON.stringify(method === "POST" ? { id: `msg-${++n}` } : { success: true }), { status: 200 });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const posts = () => calls.filter((c) => c.method === "POST");
  const deletes = () => calls.filter((c) => c.method === "DELETE");

  /** A confirmed plan for the creator and one friend, each with a seat; both can have OneSignal devices. */
  async function confirmedPlan(startAt: Date, withDevices: { creator?: string; friend?: string } = {}) {
    const movie = await M.Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
    const creator = await M.User.create({ name: "Creator", username: "creator", locale: "vi" });
    const friend = await M.User.create({ name: "Friend", username: "friend", locale: "vi" });
    const showtime = await M.Showtime.create({ movieId: movie._id, auditoriumId: oid(), layoutId: oid(), startAt, endAt: new Date(startAt.getTime() + 2 * 3600_000), formatId: oid() });
    const appt = await M.Appointment.create({
      creatorId: creator._id,
      movieId: movie._id,
      status: "CONFIRMED",
      showtimeId: showtime._id,
      timeOptions: [{ startAt, showtimeId: showtime._id, proposedBy: creator._id, votes: [] }],
      participants: [{ userId: friend._id, status: "accepted" }],
      seats: [{ userId: creator._id, seatCode: "A1" }, { userId: friend._id, seatCode: "A2" }],
    });
    appt.chosenOptionId = appt.timeOptions[0]!._id;
    await appt.save();
    if (withDevices.creator) await push.saveOneSignalDevice(creator._id.toString(), { subscriptionId: withDevices.creator });
    if (withDevices.friend) await push.saveOneSignalDevice(friend._id.toString(), { subscriptionId: withDevices.friend });
    return { id: appt._id.toString(), creator: creator._id.toString(), friend: friend._id.toString() };
  }

  describe("handing a push over", () => {
    it("holds one push per person at OneSignal until the time, with their own words, and remembers each message id", async () => {
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(5);
      const plan = await confirmedPlan(startAt, { creator: A, friend: B });
      await svc.scheduleReminders(plan.id, startAt);

      const row = (await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!;
      expect(posts()).toHaveLength(2);
      for (const post of posts()) expect(post.body?.send_after).toBe(row.sendAt.toISOString());
      const forFriend = posts().find((p) => (p.body?.include_subscription_ids as string[]).includes(B))!;
      expect(String(forFriend.body?.contents && (forFriend.body.contents as { en: string }).en)).toContain("A2");
      expect(row.pushIds.map((p) => p.userId.toString()).sort()).toEqual([plan.creator, plan.friend].sort());
      expect(row.pushIds.every((p) => /^msg-\d+$/.test(p.id))).toBe(true);
      expect(row.status).toBe("pending");
    });

    it("hands nothing over with Web Push as the provider", async () => {
      vi.stubEnv("PUSH_PROVIDER", "webpush");
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(5);
      const plan = await confirmedPlan(startAt, { creator: A });
      await svc.scheduleReminders(plan.id, startAt);
      expect(calls).toHaveLength(0);
      expect((await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!.pushIds).toHaveLength(0);
    });

    it("skips people without a device and people who turned this kind off", async () => {
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(5);
      const plan = await confirmedPlan(startAt, { creator: A, friend: B });
      await push.setPushPreference(plan.friend, "showtime_reminder", false);
      await svc.scheduleReminders(plan.id, startAt);
      expect(posts()).toHaveLength(1);
      expect((await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!.pushIds.map((p) => p.userId.toString())).toEqual([plan.creator]);
    });

    it("leaves a push more than 29 days ahead to the sweep", async () => {
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(24 * 40);
      const plan = await confirmedPlan(startAt, { creator: A });
      await svc.scheduleReminders(plan.id, startAt);
      expect(calls).toHaveLength(0);
      expect(await M.Scheduled.countDocuments({ appointmentId: plan.id, status: "pending" })).toBe(1);
    });

    it("keeps the row without message ids when OneSignal cannot be reached, so the sweep still sends the push", async () => {
      failPosts = true;
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(5);
      const plan = await confirmedPlan(startAt, { creator: A });
      await svc.scheduleReminders(plan.id, startAt);
      const row = (await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!;
      expect(row.pushIds).toHaveLength(0);
      expect(row.status).toBe("pending");

      // Due: the sweep writes the in-app message and queues the push itself, because nothing was held.
      await scheduler.processScheduledNotifications(new Date(row.sendAt.getTime() + 1000));
      expect(await M.Delivery.countDocuments({ channel: "webpush" })).toBe(1);
    });
  });

  describe("taking a push back", () => {
    it("cancels what OneSignal holds when the rows are cancelled, and marks them cancelled", async () => {
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(5);
      const plan = await confirmedPlan(startAt, { creator: A, friend: B });
      await svc.scheduleReminders(plan.id, startAt);
      const ids = (await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!.pushIds.map((p) => p.id).sort();

      await svc.cancelScheduled(plan.id);
      expect(deletes().map((d) => d.url.split("/notifications/")[1]!.split("?")[0]).sort()).toEqual(ids);
      expect(deletes().every((d) => d.url.includes("app_id=app-1"))).toBe(true);
      expect(await M.Scheduled.countDocuments({ appointmentId: plan.id, status: "cancelled" })).toBe(1);
    });

    it("takes the old pushes back when the plan is scheduled again (the time changed)", async () => {
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(5);
      const plan = await confirmedPlan(startAt, { creator: A });
      await svc.scheduleReminders(plan.id, startAt);
      await svc.scheduleReminders(plan.id, hours(6));
      expect(deletes()).toHaveLength(1);
      expect(posts()).toHaveLength(2);
      const pending = await M.Scheduled.find({ appointmentId: plan.id, status: "pending" }).lean();
      expect(pending).toHaveLength(1);
      expect(pending[0]!.pushIds).toHaveLength(1);
    });
  });

  describe("when the time comes", () => {
    it("writes the in-app message for everyone but pushes again only for people OneSignal does not hold", async () => {
      await M.Setting.create({ key: "reminderMinutesBefore", value: [30] });
      const startAt = hours(5);
      // Only the creator has a device when the push is handed over; the friend turns push on afterwards.
      const plan = await confirmedPlan(startAt, { creator: A });
      await svc.scheduleReminders(plan.id, startAt);
      await push.saveOneSignalDevice(plan.friend, { subscriptionId: C });
      const row = (await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!;

      expect(await scheduler.processScheduledNotifications(new Date(row.sendAt.getTime() + 1000))).toBe(1);
      expect(await M.Notification.countDocuments({ type: "showtime_reminder" })).toBe(2);
      const deliveries = await M.Delivery.find({ channel: "webpush" }).lean();
      const notified = await M.Notification.find({ _id: { $in: deliveries.map((d) => d.notificationId) } }).lean();
      expect(notified.map((n) => n.recipientId.toString())).toEqual([plan.friend]);
    });
  });

  describe("the 'about to expire' warning, per person", () => {
    async function invitingPlan() {
      const movie = await M.Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
      const creator = await M.User.create({ name: "Creator", username: "creator", locale: "vi" });
      const u1 = await M.User.create({ name: "U1", username: "u1", locale: "vi" });
      const u2 = await M.User.create({ name: "U2", username: "u2", locale: "vi" });
      const deadline = hours(30);
      const appt = await M.Appointment.create({
        creatorId: creator._id,
        movieId: movie._id,
        status: "INVITING",
        responseDeadline: deadline,
        timeOptions: [{ startAt: hours(60), proposedBy: creator._id, votes: [] }],
        participants: [{ userId: u1._id, status: "invited" }, { userId: u2._id, status: "invited" }],
      });
      await push.saveOneSignalDevice(u1._id.toString(), { subscriptionId: A });
      await push.saveOneSignalDevice(u2._id.toString(), { subscriptionId: B });
      return { id: appt._id.toString(), deadline, u1: u1._id.toString(), u2: u2._id.toString() };
    }

    it("holds one per person who has not answered, and takes back only the one of a person who answers", async () => {
      const plan = await invitingPlan();
      await svc.scheduleDeadlineWarning(plan.id, plan.deadline);
      expect(posts()).toHaveLength(2);
      const held = (await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!.pushIds;
      const u1Id = held.find((p) => p.userId.toString() === plan.u1)!.id;

      await svc.dropDeadlineWarningFor(plan.id, plan.u1);
      expect(deletes()).toHaveLength(1);
      expect(deletes()[0]!.url).toContain(`/notifications/${u1Id}?`);
      const after = (await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!;
      expect(after.pushIds.map((p) => p.userId.toString())).toEqual([plan.u2]);
      expect(after.status).toBe("pending");
    });

    it("is taken back for a person when they vote or decline through the appointment service", async () => {
      const appointments = await import("@/services/appointment.service");
      const plan = await invitingPlan();
      await svc.scheduleDeadlineWarning(plan.id, plan.deadline);
      const optionId = (await M.Appointment.findById(plan.id).lean())!.timeOptions[0]!._id.toString();
      calls = [];

      expect((await appointments.setVote(plan.u1, plan.id, optionId, "yes")).ok).toBe(true);
      expect(deletes()).toHaveLength(1);
      expect((await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!.pushIds.map((p) => p.userId.toString())).toEqual([plan.u2]);

      expect((await appointments.declineInvitation(plan.u2, plan.id)).ok).toBe(true);
      expect(deletes()).toHaveLength(2);
      expect((await M.Scheduled.findOne({ appointmentId: plan.id }).lean())!.pushIds).toHaveLength(0);
    });

    it("keeps a person's warning when they only take a vote back", async () => {
      const appointments = await import("@/services/appointment.service");
      const plan = await invitingPlan();
      await svc.scheduleDeadlineWarning(plan.id, plan.deadline);
      const optionId = (await M.Appointment.findById(plan.id).lean())!.timeOptions[0]!._id.toString();
      calls = [];
      expect((await appointments.setVote(plan.u1, plan.id, optionId, null)).ok).toBe(true);
      expect(deletes()).toHaveLength(0);
    });

    it("does nothing for a person with nothing held (no network call)", async () => {
      const plan = await invitingPlan();
      await svc.scheduleDeadlineWarning(plan.id, plan.deadline);
      calls = [];
      await svc.dropDeadlineWarningFor(plan.id, oid().toString());
      expect(calls).toHaveLength(0);
    });
  });
});
