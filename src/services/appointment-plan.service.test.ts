import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("appointment planning (stage 2)", () => {
  let plan: typeof import("./appointment-plan.service");
  let svc: typeof import("./appointment.service");
  let m: Record<string, { deleteMany(f: object): Promise<unknown>; create(d: object): Promise<{ _id: mongoose.Types.ObjectId }> }>;
  let creator: string;
  let u1: string;
  let u2: string;
  let movie: string;
  let showtime: string;
  // One fixed start for the agreed time and the showtime, so they match to the millisecond.
  let start: Date;
  const hours = (h: number) => new Date(Date.now() + h * 3600_000);
  const oid = () => new mongoose.Types.ObjectId();

  const seat = (row: string, col: number, extra: object = {}) => ({ code: `${row}${col}`, row, col, rowIndex: row.charCodeAt(0) - 65, colIndex: col - 1, type: "std", span: 1, x: col, y: 0, score: 5, flags: [], ...extra });

  beforeAll(async () => {
    await startTestDatabase();
    plan = await import("./appointment-plan.service");
    svc = await import("./appointment.service");
    m = {
      User: (await import("@/models/user")).User,
      Movie: (await import("@/models/movie")).Movie,
      Showtime: (await import("@/models/showtime")).Showtime,
      Appointment: (await import("@/models/appointment")).Appointment,
      Auditorium: (await import("@/models/auditorium")).Auditorium,
      Branch: (await import("@/models/branch")).Branch,
      AuditoriumLayout: (await import("@/models/auditorium-layout")).AuditoriumLayout,
      SeatClaim: (await import("@/models/seat-claim")).SeatClaim,
      Expense: (await import("@/models/expense")).Expense,
      Notification: (await import("@/models/notification")).Notification,
    } as never;
    await (await import("@/lib/db")).connectToDatabase();
    await (await import("@/models/seat-claim")).SeatClaim.init();
    await (await import("@/models/expense")).Expense.init();
  }, 120_000);
  afterAll(stopTestDatabase);

  /** A locked appointment (creator + u1 + u2 going) with a showtime in a room of 3 seats in a row plus a couple seat and a broken seat. */
  async function lockedAppointment(fromPoll = true): Promise<string> {
    const doc = await m.Appointment!.create({
      creatorId: creator,
      movieId: movie,
      status: "PARTICIPANTS_LOCKED",
      timeOptions: [{ startAt: start, showtimeId: showtime, proposedBy: creator, votes: [] }],
      participants: [{ userId: u1, status: "accepted" }, { userId: u2, status: "accepted" }],
    });
    const created = await svc.getAppointment(creator, String(doc._id));
    const appointment = await (await import("@/models/appointment")).Appointment.findById(doc._id);
    appointment!.chosenOptionId = appointment!.timeOptions[0]!._id;
    appointment!.showtimeFromPoll = fromPoll;
    await appointment!.save();
    expect(created).not.toBeNull();
    return String(doc._id);
  }

  beforeEach(async () => {
    await Promise.all(Object.values(m).map((model) => model.deleteMany({})));
    const make = async (name: string) => String((await m.User!.create({ name, username: name }))._id);
    [creator, u1, u2] = (await Promise.all(["creator", "u1", "u2"].map(make))) as [string, string, string];
    movie = String((await m.Movie!.create({ title: "Phim", durationMin: 100, releaseDate: "2026-01-01" }))._id);
    start = hours(5);
    const brandId = oid();
    const branch = await m.Branch!.create({ name: "Rạp", brandId, address: "x" });
    const room = await m.Auditorium!.create({ branchId: branch._id, name: "P1" });
    const layout = await m.AuditoriumLayout!.create({
      auditoriumId: room._id,
      version: 1,
      config: { defaultSeatType: "std" },
      seats: [seat("A", 1), seat("A", 2), seat("A", 3), seat("A", 4, { flags: ["broken"] }), seat("B", 1, { span: 2 })],
    });
    showtime = String((await m.Showtime!.create({ movieId: movie, auditoriumId: room._id, layoutId: layout._id, startAt: start, endAt: new Date(start.getTime() + 2 * 3600_000), formatId: oid() }))._id);
  });

  it("walks the whole life: planning, seats, confirm, watched, costs", async () => {
    const id = await lockedAppointment();
    expect(await plan.beginPlanning(creator, id)).toEqual({ ok: true });
    expect((await svc.getAppointment(creator, id))?.status).toBe("PLANNING");

    expect((await plan.assignSeats(creator, id, { assignments: [{ userId: creator, seatCode: "A1" }, { userId: u1, seatCode: "A2" }] })).ok).toBe(true);
    // Not everyone has a seat yet.
    expect(await plan.confirmAppointment(creator, id)).toEqual({ ok: false, error: "needs_seat" });
    expect((await plan.assignSeats(creator, id, { assignments: [{ userId: creator, seatCode: "A1" }, { userId: u1, seatCode: "A2" }, { userId: u2, seatCode: "A3" }] })).ok).toBe(true);
    expect(await plan.confirmAppointment(creator, id)).toEqual({ ok: true });
    // The two people besides the creator are told, each with their own seat.
    const told = await (await import("@/models/notification")).Notification.find({ type: "appointment_confirmed" }).lean();
    expect(told.map((n) => (n.payload as { seatCode?: string }).seatCode).sort()).toEqual(["A2", "A3"]);

    // Not before the film starts.
    expect(await plan.completeAppointment(creator, id)).toEqual({ ok: false, error: "too_early" });
    expect(await plan.completeAppointment(creator, id, hours(6))).toEqual({ ok: true });

    expect((await plan.setPersonCost(creator, id, { userId: u1, ticket: 90_000, fnb: 50_000, other: 10_000 })).ok).toBe(true);
    // A person changes their own part; someone else's is refused.
    expect((await plan.setPersonCost(u2, id, { userId: u2, ticket: 100_000, fnb: 0, other: 0, note: "đổi" })).ok).toBe(true);
    expect(await plan.setPersonCost(u2, id, { userId: u1, ticket: 1, fnb: 0, other: 0 })).toEqual({ ok: false, error: "forbidden" });

    const costs = await plan.getCosts(id);
    const stored = (await (await import("@/models/appointment")).Appointment.findById(id).lean())!.actualCost!;
    expect(stored.total).toBe(costs.totals.total);
    expect(stored.ticket).toBe(190_000);
    expect(stored.fnb).toBe(50_000);
    expect(stored.other).toBe(10_000);
    expect(stored.total).toBe(costs.perUser.reduce((s, p) => s + p.total, 0));
  });

  it("lets only one of two appointments take the same seat", async () => {
    const a = await lockedAppointment();
    const b = await lockedAppointment();
    await plan.beginPlanning(creator, a);
    await plan.beginPlanning(creator, b);
    const [ra, rb] = await Promise.all([
      plan.assignSeats(creator, a, { assignments: [{ userId: creator, seatCode: "A1" }] }),
      plan.assignSeats(creator, b, { assignments: [{ userId: creator, seatCode: "A1" }] }),
    ]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    const loser = ra.ok ? rb : ra;
    expect(loser).toEqual({ ok: false, error: "seat_taken" });
    expect(await (await import("@/models/seat-claim")).SeatClaim.countDocuments({ seatCode: "A1" })).toBe(1);
  });

  it("starts planning on the showtime the time was picked from, and with none when the time was typed by hand", async () => {
    const withShowtime = await lockedAppointment();
    await plan.beginPlanning(creator, withShowtime);
    expect((await svc.getAppointment(creator, withShowtime))?.showtimeId).toBe(showtime);

    const typed = await m.Appointment!.create({
      creatorId: creator,
      movieId: movie,
      status: "PARTICIPANTS_LOCKED",
      timeOptions: [{ startAt: start, proposedBy: creator, votes: [] }],
      participants: [{ userId: u1, status: "accepted" }],
    });
    const doc = await (await import("@/models/appointment")).Appointment.findById(typed._id);
    doc!.chosenOptionId = doc!.timeOptions[0]!._id;
    doc!.lockedStartAt = start;
    await doc!.save();
    await plan.beginPlanning(creator, String(typed._id));
    expect((await svc.getAppointment(creator, String(typed._id)))?.showtimeId).toBeUndefined();
    // The list offered for a typed time holds the showtime at that time and later ones, never earlier ones.
    const offered = await plan.getPlanData(creator, String(typed._id));
    expect(offered?.showtimes.every((x) => new Date(x.startAt).getTime() >= start.getTime())).toBe(true);
  });

  it("does not let the showtime be changed when it was already chosen with the time", async () => {
    const id = await lockedAppointment();
    const doc = await (await import("@/models/appointment")).Appointment.findById(id);
    doc!.showtimeFromPoll = true;
    await doc!.save();
    await plan.beginPlanning(creator, id);
    expect((await svc.getAppointment(creator, id))?.showtimeFixed).toBe(true);
    expect(await plan.chooseShowtime(creator, id, showtime)).toEqual({ ok: false, error: "showtime_fixed" });
  });

  it("only accepts a showtime on the day the group agreed on", async () => {
    const id = await lockedAppointment(false);
    await plan.beginPlanning(creator, id);
    const room = await m.Auditorium!.create({ branchId: oid(), name: "P2" });
    const otherDay = String((await m.Showtime!.create({ movieId: movie, auditoriumId: room._id, layoutId: oid(), startAt: new Date(start.getTime() + 48 * 3600_000), endAt: new Date(start.getTime() + 50 * 3600_000), formatId: oid() }))._id);
    expect(await plan.chooseShowtime(creator, id, otherDay)).toEqual({ ok: false, error: "wrong_day" });
    expect(await plan.chooseShowtime(creator, id, showtime)).toEqual({ ok: true });
  });

  it("does not accept a showtime earlier than the agreed time, even after moving to a later one", async () => {
    const id = await lockedAppointment(false);
    await plan.beginPlanning(creator, id);
    const doc = await (await import("@/models/appointment")).Appointment.findById(id);
    const base = doc!.timeOptions[0]!.startAt;
    doc!.lockedStartAt = base;
    await doc!.save();
    const room = await m.Auditorium!.create({ branchId: oid(), name: "P3" });
    const make = async (offsetMin: number) => String((await m.Showtime!.create({ movieId: movie, auditoriumId: room._id, layoutId: oid(), startAt: new Date(base.getTime() + offsetMin * 60_000), endAt: new Date(base.getTime() + (offsetMin + 100) * 60_000), formatId: oid() }))._id);
    const earlier = await make(-30);
    const later = await make(30);
    expect(await plan.chooseShowtime(creator, id, earlier)).toEqual({ ok: false, error: "before_agreed" });
    expect(await plan.chooseShowtime(creator, id, later)).toEqual({ ok: true });
    // Back to the agreed time itself: still allowed, because the floor is the locked time, not the new choice.
    expect(await plan.chooseShowtime(creator, id, showtime)).toEqual({ ok: true });
  });

  it("refuses broken, unknown and over-full seats and people not going", async () => {
    const id = await lockedAppointment();
    await plan.beginPlanning(creator, id);
    const seats = (...a: [string, string][]) => ({ assignments: a.map(([userId, seatCode]) => ({ userId, seatCode })) });
    expect(await plan.assignSeats(creator, id, seats([creator, "A4"]))).toEqual({ ok: false, error: "invalid_seat" });
    expect(await plan.assignSeats(creator, id, seats([creator, "Z9"]))).toEqual({ ok: false, error: "invalid_seat" });
    expect(await plan.assignSeats(creator, id, seats([creator, "A1"], [u1, "A1"]))).toEqual({ ok: false, error: "invalid_seat" });
    expect(await plan.assignSeats(creator, id, seats([String(oid()), "A1"]))).toEqual({ ok: false, error: "not_attendee" });
    // A couple seat takes two.
    expect((await plan.assignSeats(creator, id, seats([creator, "B1"], [u1, "B1"]))).ok).toBe(true);
    // Only the creator arranges seats.
    expect(await plan.assignSeats(u1, id, seats([u1, "A1"]))).toEqual({ ok: false, error: "forbidden" });
  });

  it("gives the seat back and works the money out again when someone leaves", async () => {
    const id = await lockedAppointment();
    await plan.beginPlanning(creator, id);
    await plan.assignSeats(creator, id, { assignments: [{ userId: creator, seatCode: "A1" }, { userId: u1, seatCode: "A2" }, { userId: u2, seatCode: "A3" }] });
    expect((await svc.withdraw(u2, id)).ok).toBe(true);
    const claims = (await (await import("@/models/seat-claim")).SeatClaim.find({ appointmentId: id }).lean()).map((c) => c.seatCode).sort();
    expect(claims).toEqual(["A1", "A2"]);
    const doc = await (await import("@/models/appointment")).Appointment.findById(id).lean();
    expect(doc!.estimate.map((e) => String(e.userId)).sort()).toEqual([creator, u1].sort());
    // The freed seat can be taken by someone else's plan.
    const other = await lockedAppointment();
    await plan.beginPlanning(creator, other);
    expect((await plan.assignSeats(creator, other, { assignments: [{ userId: creator, seatCode: "A3" }] })).ok).toBe(true);
  });

  it("still opens an appointment saved before stage 2 existed (no seats, food or estimate fields)", async () => {
    const id = await lockedAppointment();
    await (await import("@/models/appointment")).Appointment.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $unset: { seats: "", fnb: "", estimate: "" } });
    const view = await svc.getAppointment(creator, id);
    expect(view).toMatchObject({ seats: [], fnb: [], estimate: [] });
  });

  it("frees all seats when the appointment is cancelled", async () => {
    const id = await lockedAppointment();
    await plan.beginPlanning(creator, id);
    await plan.assignSeats(creator, id, { assignments: [{ userId: creator, seatCode: "A1" }] });
    await svc.cancelAppointment(creator, id);
    expect(await (await import("@/models/seat-claim")).SeatClaim.countDocuments({ appointmentId: id })).toBe(0);
  });
});
