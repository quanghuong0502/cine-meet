import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("personal ratings", () => {
  let svc: typeof import("./rating.service");
  let Appointment: typeof import("@/models/appointment").Appointment;
  let SeatRating: typeof import("@/models/seat-rating").SeatRating;
  const oid = () => new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./rating.service");
    Appointment = (await import("@/models/appointment")).Appointment;
    SeatRating = (await import("@/models/seat-rating")).SeatRating;
    await (await import("@/lib/db")).connectToDatabase();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), SeatRating.deleteMany({})]);
  });

  async function completed(userId: mongoose.Types.ObjectId, seatCode: string, status: "COMPLETED" | "PLANNING" = "COMPLETED") {
    return Appointment.create({
      creatorId: userId,
      movieId: oid(),
      status,
      timeOptions: [{ startAt: new Date(), proposedBy: userId, votes: [] }],
      seats: [{ userId, seatCode }],
    });
  }

  it("only someone who sat there, after the viewing is done, may rate the seat", async () => {
    const me = oid();
    const stranger = oid();
    const done = await completed(me, "F7");
    const planning = await completed(me, "F7", "PLANNING");
    const base = { auditoriumId: oid().toString(), layoutId: oid().toString(), seatCode: "F7", rating: 4 };
    expect(await svc.rateSeat(stranger.toString(), { ...base, appointmentId: done._id.toString() })).toEqual({ ok: false, error: "forbidden" });
    expect(await svc.rateSeat(me.toString(), { ...base, appointmentId: planning._id.toString() })).toEqual({ ok: false, error: "forbidden" });
    expect(await svc.rateSeat(me.toString(), { ...base, appointmentId: done._id.toString() })).toEqual({ ok: true });
  });

  it("rating the same seat again for a viewing replaces the old rating", async () => {
    const me = oid();
    const done = await completed(me, "F7");
    const auditoriumId = oid().toString();
    const base = { auditoriumId, layoutId: oid().toString(), seatCode: "F7", appointmentId: done._id.toString() };
    await svc.rateSeat(me.toString(), { ...base, rating: 2 });
    await svc.rateSeat(me.toString(), { ...base, rating: 5 });
    expect(await SeatRating.countDocuments({ userId: me })).toBe(1);
    expect(await svc.getMySeatRatings(me.toString(), done._id.toString())).toEqual({ F7: 5 });
  });

  it("the room's sitting history shows only the caller's own ratings", async () => {
    const me = oid();
    const other = oid();
    const auditoriumId = oid();
    const layoutId = oid();
    await SeatRating.create({ userId: me, auditoriumId, layoutId, seatCode: "F7", rating: 3 });
    await SeatRating.create({ userId: me, auditoriumId, layoutId, seatCode: "F7", rating: 5 }); // a later viewing wins
    await SeatRating.create({ userId: other, auditoriumId, layoutId, seatCode: "G1", rating: 1 });
    expect(await svc.getMySeatRatingsForRoom(me.toString(), auditoriumId.toString())).toEqual({ F7: 5 });
    expect(await svc.getMySeatRatingsForRoom(me.toString(), oid().toString())).toEqual({});
  });
});
