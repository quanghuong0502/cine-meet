import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("scheduler (scheduled notifications and auto-complete)", () => {
  let scheduler: typeof import("./scheduler");
  let Appointment: typeof import("@/models/appointment").Appointment;
  let ScheduledNotification: typeof import("@/models/scheduled-notification").ScheduledNotification;
  let Notification: typeof import("@/models/notification").Notification;
  let Movie: typeof import("@/models/movie").Movie;
  let Showtime: typeof import("@/models/showtime").Showtime;
  let User: typeof import("@/models/user").User;
  const oid = () => new mongoose.Types.ObjectId();
  const hours = (h: number, from = Date.now()) => new Date(from + h * 3600_000);
  const now = new Date("2026-01-10T00:00:00.000Z");

  beforeAll(async () => {
    await startTestDatabase();
    scheduler = await import("./scheduler");
    Appointment = (await import("@/models/appointment")).Appointment;
    ScheduledNotification = (await import("@/models/scheduled-notification")).ScheduledNotification;
    Notification = (await import("@/models/notification")).Notification;
    Movie = (await import("@/models/movie")).Movie;
    Showtime = (await import("@/models/showtime")).Showtime;
    User = (await import("@/models/user")).User;
    await (await import("@/lib/db")).connectToDatabase();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), ScheduledNotification.deleteMany({}), Notification.deleteMany({}), Movie.deleteMany({}), Showtime.deleteMany({}), User.deleteMany({})]);
  });

  describe("processScheduledNotifications", () => {
    it("sends a due reminder to every attendee with their own seat, and marks the row sent", async () => {
      const movie = await Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
      const creator = await User.create({ name: "Creator", username: "creator" });
      const u1 = await User.create({ name: "U1", username: "u1" });
      const start = hours(1, now.getTime());
      const showtime = await Showtime.create({ movieId: movie._id, auditoriumId: oid(), layoutId: oid(), startAt: start, endAt: hours(3, now.getTime()), formatId: oid() });
      const appt = await Appointment.create({
        creatorId: creator._id,
        movieId: movie._id,
        status: "CONFIRMED",
        showtimeId: showtime._id,
        timeOptions: [{ startAt: start, showtimeId: showtime._id, proposedBy: creator._id, votes: [] }],
        participants: [{ userId: u1._id, status: "accepted" }],
        seats: [{ userId: creator._id, seatCode: "A1" }, { userId: u1._id, seatCode: "A2" }],
      });
      appt.chosenOptionId = appt.timeOptions[0]!._id;
      await appt.save();
      const row = await ScheduledNotification.create({ appointmentId: appt._id, type: "reminder", minutesBefore: 20, sendAt: hours(-1, now.getTime()), status: "pending" });

      const handled = await scheduler.processScheduledNotifications(now);
      expect(handled).toBe(1);
      expect((await ScheduledNotification.findById(row._id))!.status).toBe("sent");
      const notes = await Notification.find({ type: "showtime_reminder" }).lean();
      expect(notes).toHaveLength(2);
      const forU1 = notes.find((n) => n.recipientId.toString() === u1._id.toString());
      expect((forU1!.payload as { seatCode?: string }).seatCode).toBe("A2");
      const forCreator = notes.find((n) => n.recipientId.toString() === creator._id.toString());
      expect((forCreator!.payload as { seatCode?: string }).seatCode).toBe("A1");
    });

    it("drops (cancels) a reminder row whose appointment is no longer confirmed", async () => {
      const movie = await Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
      const creator = await User.create({ name: "Creator", username: "creator" });
      const appt = await Appointment.create({ creatorId: creator._id, movieId: movie._id, status: "CANCELLED", timeOptions: [] });
      const row = await ScheduledNotification.create({ appointmentId: appt._id, type: "reminder", minutesBefore: 20, sendAt: hours(-1, now.getTime()), status: "pending" });

      await scheduler.processScheduledNotifications(now);
      expect((await ScheduledNotification.findById(row._id))!.status).toBe("cancelled");
      expect(await Notification.countDocuments({})).toBe(0);
    });

    it("sends a deadline warning only to participants who have not answered", async () => {
      const movie = await Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
      const creator = await User.create({ name: "Creator", username: "creator" });
      const answered = await User.create({ name: "Answered", username: "answered" });
      const notYet = await User.create({ name: "NotYet", username: "notyet" });
      const appt = await Appointment.create({
        creatorId: creator._id,
        movieId: movie._id,
        status: "INVITING",
        responseDeadline: hours(10, now.getTime()),
        timeOptions: [{ startAt: hours(20, now.getTime()), proposedBy: creator._id, votes: [] }],
        participants: [{ userId: answered._id, status: "accepted" }, { userId: notYet._id, status: "invited" }],
      });
      await ScheduledNotification.create({ appointmentId: appt._id, type: "deadline_warning", sendAt: hours(-1, now.getTime()), status: "pending" });

      await scheduler.processScheduledNotifications(now);
      const notes = await Notification.find({ type: "response_deadline_warning" }).lean();
      expect(notes).toHaveLength(1);
      expect(notes[0]!.recipientId.toString()).toBe(notYet._id.toString());
    });

    it("claims a row stuck in processing for too long (a dead worker) and finishes it", async () => {
      const movie = await Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
      const creator = await User.create({ name: "Creator", username: "creator" });
      const appt = await Appointment.create({ creatorId: creator._id, movieId: movie._id, status: "CANCELLED", timeOptions: [] });
      const row = await ScheduledNotification.create({ appointmentId: appt._id, type: "reminder", minutesBefore: 20, sendAt: hours(-5, now.getTime()), status: "processing" });
      await ScheduledNotification.updateOne({ _id: row._id }, { $set: { updatedAt: hours(-1, now.getTime()) } }, { timestamps: false });

      const handled = await scheduler.processScheduledNotifications(now);
      expect(handled).toBe(1);
      expect((await ScheduledNotification.findById(row._id))!.status).toBe("cancelled");
    });
  });

  describe("autoCompleteOverdueAppointments", () => {
    it("moves a confirmed appointment to COMPLETED once its showtime has ended", async () => {
      const movie = await Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
      const creator = await User.create({ name: "Creator", username: "creator" });
      const start = hours(-3, now.getTime());
      const showtime = await Showtime.create({ movieId: movie._id, auditoriumId: oid(), layoutId: oid(), startAt: start, endAt: hours(-1, now.getTime()), formatId: oid() });
      const appt = await Appointment.create({
        creatorId: creator._id,
        movieId: movie._id,
        status: "CONFIRMED",
        showtimeId: showtime._id,
        timeOptions: [{ startAt: start, showtimeId: showtime._id, proposedBy: creator._id, votes: [] }],
        seats: [{ userId: creator._id, seatCode: "A1" }],
      });
      appt.chosenOptionId = appt.timeOptions[0]!._id;
      await appt.save();

      const count = await scheduler.autoCompleteOverdueAppointments(now);
      expect(count).toBe(1);
      expect((await Appointment.findById(appt._id))!.status).toBe("COMPLETED");
    });

    it("leaves a confirmed appointment alone while its showtime has not ended yet", async () => {
      const movie = await Movie.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" });
      const creator = await User.create({ name: "Creator", username: "creator" });
      const start = hours(-3, now.getTime());
      const showtime = await Showtime.create({ movieId: movie._id, auditoriumId: oid(), layoutId: oid(), startAt: start, endAt: hours(1, now.getTime()), formatId: oid() });
      const appt = await Appointment.create({
        creatorId: creator._id,
        movieId: movie._id,
        status: "CONFIRMED",
        showtimeId: showtime._id,
        timeOptions: [{ startAt: start, showtimeId: showtime._id, proposedBy: creator._id, votes: [] }],
        seats: [{ userId: creator._id, seatCode: "A1" }],
      });
      appt.chosenOptionId = appt.timeOptions[0]!._id;
      await appt.save();

      expect(await scheduler.autoCompleteOverdueAppointments(now)).toBe(0);
      expect((await Appointment.findById(appt._id))!.status).toBe("CONFIRMED");
    });
  });
});
