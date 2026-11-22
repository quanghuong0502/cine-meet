import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("the cron round, the sweep on open, and sending right after a request", () => {
  let route: typeof import("@/app/api/cron/tick/route");
  let sweep: typeof import("./sweep");
  let kick: typeof import("./kick");
  let Scheduled: typeof import("@/models/scheduled-notification").ScheduledNotification;
  const oid = () => new mongoose.Types.ObjectId();
  const SECRET = "test-secret-0123456789";
  const call = (headers: Record<string, string> = {}) => route.GET(new Request("http://localhost/api/cron/tick", { headers }));
  const bearer = (value: string) => ({ authorization: `Bearer ${value}` });
  /** A due notification for an appointment that is gone: nothing to send, so the sweep drops it (status cancelled). */
  const dueRow = () => Scheduled.create({ appointmentId: oid(), type: "reminder", minutesBefore: 20, sendAt: new Date(Date.now() - 60_000), status: "pending" });

  beforeAll(async () => {
    await startTestDatabase();
    route = await import("@/app/api/cron/tick/route");
    sweep = await import("./sweep");
    kick = await import("./kick");
    Scheduled = (await import("@/models/scheduled-notification")).ScheduledNotification;
    await (await import("@/lib/db")).connectToDatabase();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("ENABLE_WORKER", "");
    sweep.resetSweepForTests();
    await Scheduled.deleteMany({});
  });
  afterEach(() => vi.unstubAllEnvs());

  describe("GET /api/cron/tick", () => {
    it("refuses a call without the secret, with a wrong one, or with one of another length", async () => {
      await dueRow();
      for (const headers of [{}, bearer("wrong"), bearer(SECRET + "x"), bearer(SECRET.slice(0, -1)), { authorization: SECRET.toUpperCase() }]) {
        expect((await call(headers)).status).toBe(401);
      }
      // Nothing ran for any of them.
      expect(await Scheduled.countDocuments({ status: "pending" })).toBe(1);
    });

    it("refuses everyone when CRON_SECRET is not set, even with an empty key", async () => {
      vi.stubEnv("CRON_SECRET", "");
      await dueRow();
      expect((await call(bearer(""))).status).toBe(401);
      expect((await call()).status).toBe(401);
      expect(await Scheduled.countDocuments({ status: "pending" })).toBe(1);
    });

    it("runs one round with the right secret and says what it did", async () => {
      await dueRow();
      const response = await call(bearer(SECRET));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, scheduled: 1, deliveries: 0, completed: 0 });
      expect(await Scheduled.countDocuments({ status: "pending" })).toBe(0);
    });

    it("never handles one row twice when two calls overlap", async () => {
      for (let i = 0; i < 4; i++) await dueRow();
      const [a, b] = await Promise.all([call(bearer(SECRET)), call(bearer(SECRET))]);
      const total = ((await a.json()) as { scheduled: number }).scheduled + ((await b.json()) as { scheduled: number }).scheduled;
      expect(total).toBe(4);
    });
  });

  describe("sweepDueNotifications", () => {
    it("brings due notifications in, at most once per half minute", async () => {
      await dueRow();
      await sweep.sweepDueNotifications(1_000_000);
      expect(await Scheduled.countDocuments({ status: "pending" })).toBe(0);

      await dueRow();
      await sweep.sweepDueNotifications(1_000_000 + 10_000); // too soon after the last one
      expect(await Scheduled.countDocuments({ status: "pending" })).toBe(1);
      await sweep.sweepDueNotifications(1_000_000 + 31_000);
      expect(await Scheduled.countDocuments({ status: "pending" })).toBe(0);
    });

    it("shares one sweep between callers that arrive together (the layout and the page)", async () => {
      await dueRow();
      await Promise.all([sweep.sweepDueNotifications(5_000_000), sweep.sweepDueNotifications(5_000_000)]);
      expect(await Scheduled.countDocuments({ status: "cancelled" })).toBe(1);
    });

    it("stays out when this process runs the worker", async () => {
      vi.stubEnv("ENABLE_WORKER", "true");
      await dueRow();
      await sweep.sweepDueNotifications(9_000_000);
      expect(await Scheduled.countDocuments({ status: "pending" })).toBe(1);
    });
  });

  describe("kickDeliveries", () => {
    it("does nothing, and does not throw, outside a request (a script, a test) or when push is not set up", async () => {
      vi.stubEnv("PUSH_PROVIDER", "onesignal");
      vi.stubEnv("ONESIGNAL_APP_ID", "app-1");
      vi.stubEnv("ONESIGNAL_API_KEY", "key-1");
      await expect(kick.kickDeliveries()).resolves.toBeUndefined();
      vi.stubEnv("ONESIGNAL_API_KEY", "");
      await expect(kick.kickDeliveries()).resolves.toBeUndefined();
      vi.stubEnv("ENABLE_WORKER", "true");
      await expect(kick.kickDeliveries()).resolves.toBeUndefined();
    });
  });
});
