import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("scheduled notifications (reminders and deadline warnings)", () => {
  let svc: typeof import("./scheduled-notification.service");
  let Appointment: typeof import("@/models/appointment").Appointment;
  let ScheduledNotification: typeof import("@/models/scheduled-notification").ScheduledNotification;
  let SystemSetting: typeof import("@/models/system-setting").SystemSetting;
  const oid = () => new mongoose.Types.ObjectId();
  const hours = (h: number, from = Date.now()) => new Date(from + h * 3600_000);
  const now = new Date("2026-01-10T00:00:00.000Z");

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./scheduled-notification.service");
    Appointment = (await import("@/models/appointment")).Appointment;
    ScheduledNotification = (await import("@/models/scheduled-notification")).ScheduledNotification;
    SystemSetting = (await import("@/models/system-setting")).SystemSetting;
    await (await import("@/lib/db")).connectToDatabase();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), ScheduledNotification.deleteMany({}), SystemSetting.deleteMany({})]);
  });

  async function makeAppointment(status: "INVITING" | "PLANNING" | "CONFIRMED", startAt: Date) {
    const doc = await Appointment.create({
      creatorId: oid(),
      movieId: oid(),
      status,
      timeOptions: [{ startAt, proposedBy: oid(), votes: [] }],
      showtimeId: status === "CONFIRMED" ? oid() : undefined,
    });
    doc.chosenOptionId = doc.timeOptions[0]!._id;
    await doc.save();
    return doc._id.toString();
  }

  describe("scheduleReminders", () => {
    it("makes one row per configured lead time, and removes rows from a previous call", async () => {
      await SystemSetting.create({ key: "reminderMinutesBefore", value: [48, 20] });
      const id = await makeAppointment("CONFIRMED", hours(50, now.getTime()));
      await svc.scheduleReminders(id, hours(50, now.getTime()), now);
      const rows = await ScheduledNotification.find({ appointmentId: id }).lean();
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.minutesBefore).sort()).toEqual([20, 48]);
      expect(rows.every((r) => r.status === "pending")).toBe(true);

      // A second call (the time changed) drops the earlier rows instead of piling up.
      await svc.scheduleReminders(id, hours(51, now.getTime()), now);
      expect(await ScheduledNotification.countDocuments({ appointmentId: id, status: "pending" })).toBe(2);
      expect(await ScheduledNotification.countDocuments({ appointmentId: id, status: "cancelled" })).toBe(2);
    });

    it("skips a lead time whose moment has already passed", async () => {
      await SystemSetting.create({ key: "reminderMinutesBefore", value: [1440, 20] });
      const id = await makeAppointment("CONFIRMED", hours(0.1, now.getTime()));
      await svc.scheduleReminders(id, hours(0.1, now.getTime()), now);
      const rows = await ScheduledNotification.find({ appointmentId: id }).lean();
      expect(rows).toHaveLength(0);
    });
  });

  describe("scheduleDeadlineWarning", () => {
    it("schedules one row 12h before the deadline", async () => {
      const id = await makeAppointment("INVITING", hours(48, now.getTime()));
      const deadline = hours(24, now.getTime());
      await svc.scheduleDeadlineWarning(id, deadline, now);
      const rows = await ScheduledNotification.find({ appointmentId: id, type: "deadline_warning" }).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.sendAt.getTime()).toBe(deadline.getTime() - 12 * 3600_000);
    });

    it("schedules nothing when the deadline is already under 12h away", async () => {
      const id = await makeAppointment("INVITING", hours(48, now.getTime()));
      await svc.scheduleDeadlineWarning(id, hours(6, now.getTime()), now);
      expect(await ScheduledNotification.countDocuments({ appointmentId: id, type: "deadline_warning" })).toBe(0);
    });
  });

  describe("cancelScheduled", () => {
    it("cancels only pending rows of the given types, leaving others alone", async () => {
      const id = await makeAppointment("CONFIRMED", hours(5, now.getTime()));
      await ScheduledNotification.create([
        { appointmentId: id, type: "reminder", minutesBefore: 20, sendAt: hours(1, now.getTime()), status: "pending" },
        { appointmentId: id, type: "deadline_warning", sendAt: hours(1, now.getTime()), status: "pending" },
        { appointmentId: id, type: "reminder", minutesBefore: 1440, sendAt: hours(-1, now.getTime()), status: "sent" },
      ]);
      await svc.cancelScheduled(id, ["reminder"]);
      const rows = await ScheduledNotification.find({ appointmentId: id }).lean();
      expect(rows.find((r) => r.type === "reminder" && r.status === "pending")).toBeUndefined();
      expect(rows.find((r) => r.type === "deadline_warning")?.status).toBe("pending");
      expect(rows.find((r) => r.status === "sent")).toBeTruthy();
    });

    it("cancels every pending type when none is given", async () => {
      const id = await makeAppointment("CONFIRMED", hours(5, now.getTime()));
      await ScheduledNotification.create([
        { appointmentId: id, type: "reminder", minutesBefore: 20, sendAt: hours(1, now.getTime()), status: "pending" },
        { appointmentId: id, type: "deadline_warning", sendAt: hours(1, now.getTime()), status: "pending" },
      ]);
      await svc.cancelScheduled(id);
      expect(await ScheduledNotification.countDocuments({ appointmentId: id, status: "pending" })).toBe(0);
    });
  });

  describe("recomputeAllReminders", () => {
    it("recomputes reminders of every confirmed, not-yet-started appointment, and skips the rest", async () => {
      await SystemSetting.create({ key: "reminderMinutesBefore", value: [10] });
      const confirmed = await makeAppointment("CONFIRMED", hours(5, now.getTime()));
      const started = await makeAppointment("CONFIRMED", hours(-1, now.getTime()));
      const planning = await makeAppointment("PLANNING", hours(5, now.getTime()));
      await ScheduledNotification.create({ appointmentId: confirmed, type: "reminder", minutesBefore: 1440, sendAt: hours(1, now.getTime()), status: "pending" });

      const count = await svc.recomputeAllReminders(now);
      expect(count).toBe(1);
      const rows = await ScheduledNotification.find({ appointmentId: confirmed }).lean();
      expect(rows.filter((r) => r.status === "pending")).toHaveLength(1);
      expect(rows.find((r) => r.status === "pending")?.minutesBefore).toBe(10);
      expect(await ScheduledNotification.countDocuments({ appointmentId: started })).toBe(0);
      expect(await ScheduledNotification.countDocuments({ appointmentId: planning })).toBe(0);
    });
  });
});
