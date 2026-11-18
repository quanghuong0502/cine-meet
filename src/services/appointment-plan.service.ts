import mongoose, { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EXPENSE_CATEGORIES, sumCosts, type ExpenseCategory } from "@/lib/appointment/cost";
import { canTransition } from "@/lib/appointment/state";
import { Appointment } from "@/models/appointment";
import { Auditorium } from "@/models/auditorium";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { Branch } from "@/models/branch";
import { Expense } from "@/models/expense";
import { FnbCombo } from "@/models/fnb-combo";
import { FnbItem } from "@/models/fnb-item";
import { SeatClaim } from "@/models/seat-claim";
import { Showtime } from "@/models/showtime";
import { attendeeIdsOf, loadSeatPrices, recomputeEstimate } from "@/services/appointment-estimate";
import { mutate, notifyPeople, sameId, type Doc, type Failure } from "@/services/appointment.service";
import { comboPrice } from "@/services/pricing/combo-price";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, { error: "invalid" });

/** The chosen time of an appointment, or null before one is picked. */
function chosenOption(doc: Doc) {
  return doc.timeOptions.find((o) => sameId(o._id, doc.chosenOptionId?.toString() ?? ""));
}

async function placeOf(showtimeId: string | undefined): Promise<string> {
  if (!showtimeId) return "";
  const showtime = await Showtime.findById(showtimeId, "auditoriumId").lean();
  const room = showtime ? await Auditorium.findById(showtime.auditoriumId, "name branchId").lean() : null;
  const branch = room ? await Branch.findById(room.branchId, "name").lean() : null;
  return [branch?.name, room?.name].filter(Boolean).join(" · ");
}

// ---------- stage 2 ----------

/** The creator starts planning the details. The showtime is filled in already when the locked time pointed at one. */
export async function beginPlanning(creatorId: string, id: string): Promise<{ ok: true } | Failure> {
  return mutate(id, (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (!canTransition(doc.status, "PLANNING")) return { ok: false as const, error: "bad_state" as const };
    const chosen = chosenOption(doc);
    if (chosen?.showtimeId) doc.set("showtimeId", chosen.showtimeId);
    doc.status = "PLANNING";
    return { ok: true as const };
  });
}

/** Releases every seat the appointment holds and clears its seat list (the room or time changed, so the old seats mean nothing). */
async function clearSeats(id: string): Promise<void> {
  await SeatClaim.deleteMany({ appointmentId: id });
}

/**
 * The creator picks the showtime (it must be this movie's and not started). The appointment's time follows the showtime. Seats are
 * cleared because they belong to the old room. After confirming, everyone going is told the time changed.
 */
export async function chooseShowtime(creatorId: string, id: string, showtimeId: string, now = new Date()): Promise<{ ok: true } | Failure> {
  if (!isValidObjectId(showtimeId)) return { ok: false, error: "no_showtime" };
  await connectToDatabase();
  const result = await mutate(id, async (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (doc.status !== "PLANNING" && doc.status !== "CONFIRMED") return { ok: false as const, error: "bad_state" as const };
    const showtime = await Showtime.findOne({ _id: showtimeId, movieId: doc.movieId }, "startAt").lean();
    if (!showtime || showtime.startAt.getTime() <= now.getTime()) return { ok: false as const, error: "no_showtime" as const };
    if (sameId(doc.showtimeId, showtimeId)) return { ok: true as const, changed: false, wasConfirmed: false, slotAt: showtime.startAt.toISOString(), attendeeIds: [] as string[] };

    let option = doc.timeOptions.find((o) => sameId(o.showtimeId, showtimeId));
    if (!option) option = doc.timeOptions[doc.timeOptions.push({ startAt: showtime.startAt, showtimeId: showtime._id, proposedBy: creatorId, votes: [] }) - 1]!;
    doc.chosenOptionId = option._id;
    doc.set("showtimeId", showtime._id);
    doc.set("seats", []);
    await recomputeEstimate(doc);
    return { ok: true as const, changed: true, wasConfirmed: doc.status === "CONFIRMED", slotAt: showtime.startAt.toISOString(), attendeeIds: attendeeIdsOf(doc) };
  });
  if (!result.ok) return result;
  if (result.changed) {
    await clearSeats(id);
    if (result.wasConfirmed) await notifyPeople(id, creatorId, "appointment_changed", result.attendeeIds, { change: "time", slotAt: result.slotAt, place: await placeOf(showtimeId) });
  }
  return { ok: true };
}

export const assignSeatsSchema = z.object({
  /** The whole seating plan: each person at most once, a seat code up to as many times as it has places (2 for a couple seat). */
  assignments: z.array(z.object({ userId: objectId, seatCode: z.string().trim().min(1).max(8) })).max(40),
});
export type AssignSeatsInput = z.infer<typeof assignSeatsSchema>;

const SEAT_TRIES = 3;

/**
 * Saves the seating plan. It replaces the previous plan. The appointment's seat list and its seat claims are written in one
 * transaction; a seat another appointment already holds fails the claim (unique index) and nothing is saved. Broken seats, seats
 * that do not exist, more people than places and people not going are refused.
 */
export async function assignSeats(creatorId: string, id: string, input: AssignSeatsInput): Promise<{ ok: true; affectedIds: string[] } | Failure> {
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const first = await Appointment.findById(id, "creatorId status showtimeId").lean();
  if (!first) return { ok: false, error: "not_found" };
  if (!sameId(first.creatorId, creatorId)) return { ok: false, error: "forbidden" };
  if (first.status !== "PLANNING" && first.status !== "CONFIRMED") return { ok: false, error: "bad_state" };
  if (!first.showtimeId) return { ok: false, error: "no_showtime" };
  const showtime = await Showtime.findById(first.showtimeId, "layoutId").lean();
  const layout = showtime ? await AuditoriumLayout.findById(showtime.layoutId, "seats").lean() : null;
  if (!layout) return { ok: false, error: "no_showtime" };
  const seatByCode = new Map(layout.seats.map((s) => [s.code, s]));

  const people = new Set<string>();
  const perSeat = new Map<string, number>();
  for (const a of input.assignments) {
    const seat = seatByCode.get(a.seatCode);
    if (!seat || seat.flags.includes("broken")) return { ok: false, error: "invalid_seat" };
    if (people.has(a.userId)) return { ok: false, error: "invalid_seat" };
    people.add(a.userId);
    perSeat.set(a.seatCode, (perSeat.get(a.seatCode) ?? 0) + 1);
    if ((perSeat.get(a.seatCode) ?? 0) > seat.span) return { ok: false, error: "invalid_seat" };
  }
  const codes = [...perSeat.keys()];

  for (let attempt = 0; attempt < SEAT_TRIES; attempt++) {
    const session = await mongoose.startSession();
    let outcome: ({ ok: true; affectedIds: string[] } | Failure) | undefined;
    try {
      await session.withTransaction(async () => {
        outcome = undefined;
        const doc = await Appointment.findById(id).session(session);
        if (!doc || (doc.status !== "PLANNING" && doc.status !== "CONFIRMED") || !sameId(doc.showtimeId, first.showtimeId!.toString())) {
          outcome = { ok: false, error: "bad_state" };
          return;
        }
        const attendees = attendeeIdsOf(doc);
        if ([...people].some((userId) => !attendees.includes(userId))) {
          outcome = { ok: false, error: "not_attendee" };
          return;
        }
        const before = new Map(doc.seats.map((s) => [s.userId.toString(), s.seatCode]));
        await SeatClaim.deleteMany({ appointmentId: id }, { session });
        if (codes.length > 0) await SeatClaim.insertMany(codes.map((seatCode) => ({ showtimeId: doc.showtimeId, seatCode, appointmentId: id })), { session, ordered: true });
        doc.set("seats", input.assignments.map((a) => ({ userId: a.userId, seatCode: a.seatCode })));
        await recomputeEstimate(doc);
        await doc.save({ session });
        const after = new Map(input.assignments.map((a) => [a.userId, a.seatCode]));
        const affectedIds = [...new Set([...before.keys(), ...after.keys()])].filter((userId) => before.get(userId) !== after.get(userId));
        outcome = { ok: true, affectedIds };
      });
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 11000) return { ok: false, error: "seat_taken" };
      if ((error as { name?: string }).name === "VersionError") continue;
      throw error;
    } finally {
      await session.endSession();
    }
    if (outcome) {
      if (outcome.ok) {
        const doc = await Appointment.findById(id, "status showtimeId").lean();
        if (doc?.status === "CONFIRMED" && outcome.affectedIds.length > 0) {
          const place = await placeOf(doc.showtimeId?.toString());
          for (const userId of outcome.affectedIds.filter((u) => u !== creatorId)) {
            await notifyPeople(id, creatorId, "appointment_changed", [userId], { change: "seat", seatCode: input.assignments.find((a) => a.userId === userId)?.seatCode, place });
          }
        }
      }
      return outcome;
    }
  }
  return { ok: false, error: "conflict" };
}

/** Seats held by other appointments in a showtime, so the picker can show them as taken. */
export async function takenSeatCodes(showtimeId: string, exceptAppointmentId: string): Promise<string[]> {
  const claims = await SeatClaim.find({ showtimeId, appointmentId: { $ne: exceptAppointmentId } }, "seatCode").lean();
  return claims.map((c) => c.seatCode);
}

export const setFoodSchema = z.object({
  lines: z
    .array(
      z.object({
        /** Missing = shared by the whole group. */
        ownerId: objectId.optional(),
        kind: z.enum(["item", "combo"]),
        refId: objectId,
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(60),
});
export type SetFoodInput = z.infer<typeof setFoodSchema>;

/** Replaces the food and drink list. Names and prices are read now and kept with the line. Only this cinema brand's items count. */
export async function setFood(creatorId: string, id: string, input: SetFoodInput): Promise<{ ok: true } | Failure> {
  await connectToDatabase();
  return mutate(id, async (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (doc.status !== "PLANNING" && doc.status !== "CONFIRMED") return { ok: false as const, error: "bad_state" as const };
    if (!doc.showtimeId) return { ok: false as const, error: "no_showtime" as const };
    const attendees = attendeeIdsOf(doc);
    if (input.lines.some((l) => l.ownerId && !attendees.includes(l.ownerId))) return { ok: false as const, error: "not_attendee" as const };

    const showtime = await Showtime.findById(doc.showtimeId, "auditoriumId").lean();
    const room = showtime ? await Auditorium.findById(showtime.auditoriumId, "branchId").lean() : null;
    const branch = room ? await Branch.findById(room.branchId, "brandId").lean() : null;
    if (!branch) return { ok: false as const, error: "no_showtime" as const };

    const [items, combos] = await Promise.all([
      FnbItem.find({ brandId: branch.brandId, _id: { $in: input.lines.filter((l) => l.kind === "item").map((l) => l.refId) } }).lean(),
      FnbCombo.find({ brandId: branch.brandId, _id: { $in: input.lines.filter((l) => l.kind === "combo").map((l) => l.refId) } }).lean(),
    ]);
    const itemById = new Map(items.map((i) => [i._id.toString(), i]));
    const comboItemIds = [...new Set(combos.flatMap((c) => c.items.map((i) => i.itemId.toString())))];
    const comboItems = new Map((await FnbItem.find({ _id: { $in: comboItemIds } }).lean()).map((i) => [i._id.toString(), i]));
    const comboById = new Map(combos.map((c) => [c._id.toString(), c]));

    const lines = [];
    for (const l of input.lines) {
      if (l.kind === "item") {
        const item = itemById.get(l.refId);
        if (!item) return { ok: false as const, error: "invalid_food" as const };
        lines.push({ ownerId: l.ownerId, kind: "item" as const, refId: l.refId, name: [item.name, item.size].filter(Boolean).join(" "), unitPrice: item.price, quantity: l.quantity });
      } else {
        const combo = comboById.get(l.refId);
        if (!combo) return { ok: false as const, error: "invalid_food" as const };
        const price = comboPrice(
          combo.items.map((i) => ({ price: comboItems.get(i.itemId.toString())?.price ?? 0, quantity: i.quantity })),
          { type: combo.discountType ?? "amount", value: combo.discountValue ?? 0 },
        ).price;
        lines.push({ ownerId: l.ownerId, kind: "combo" as const, refId: l.refId, name: combo.name, unitPrice: price, quantity: l.quantity });
      }
    }
    doc.set("fnb", lines);
    await recomputeEstimate(doc);
    return { ok: true as const };
  });
}

/** The creator confirms the plan: it needs a showtime and a seat for everyone going. Everyone else hears it with their own seat. */
export async function confirmAppointment(creatorId: string, id: string): Promise<{ ok: true } | Failure> {
  await connectToDatabase();
  const result = await mutate(id, async (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (!canTransition(doc.status, "CONFIRMED")) return { ok: false as const, error: "bad_state" as const };
    if (!doc.showtimeId) return { ok: false as const, error: "no_showtime" as const };
    const attendees = attendeeIdsOf(doc);
    if (attendees.some((userId) => !doc.seats.some((s) => sameId(s.userId, userId)))) return { ok: false as const, error: "needs_seat" as const };
    await recomputeEstimate(doc);
    doc.status = "CONFIRMED";
    doc.confirmedAt = new Date();
    const mine = (userId: string) => doc.seats.find((s) => sameId(s.userId, userId))?.seatCode;
    return { ok: true as const, showtimeId: doc.showtimeId.toString(), slotAt: chosenOption(doc)?.startAt.toISOString(), seats: attendees.filter((u) => u !== creatorId).map((u) => [u, mine(u)] as const) };
  });
  if (!result.ok) return result;
  const place = await placeOf(result.showtimeId);
  for (const [userId, seatCode] of result.seats) await notifyPeople(id, creatorId, "appointment_confirmed", [userId], { slotAt: result.slotAt, place, seatCode });
  return { ok: true };
}

/** Rebuilds the appointment's group cost from everyone's expenses, so the two can never disagree. */
async function syncActualCost(id: string): Promise<void> {
  const rows = await Expense.aggregate<{ _id: ExpenseCategory; amount: number }>([{ $match: { appointmentId: new mongoose.Types.ObjectId(id) } }, { $group: { _id: "$category", amount: { $sum: "$amount" } } }]);
  const by = new Map(rows.map((r) => [r._id, r.amount]));
  const totals = sumCosts([{ ticket: by.get("ticket") ?? 0, fnb: by.get("fnb") ?? 0, other: by.get("other") ?? 0 }]);
  await Appointment.updateOne({ _id: id }, { $set: { actualCost: totals } });
}

/**
 * "Watched": the creator closes the plan after the film has started. Each person's estimate becomes their first real cost (they can
 * change it), and the group total is worked out from those.
 */
export async function completeAppointment(creatorId: string, id: string, now = new Date()): Promise<{ ok: true } | Failure> {
  await connectToDatabase();
  const result = await mutate(id, (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (!canTransition(doc.status, "COMPLETED")) return { ok: false as const, error: "bad_state" as const };
    const start = chosenOption(doc)?.startAt;
    if (!start || start.getTime() > now.getTime()) return { ok: false as const, error: "too_early" as const };
    doc.status = "COMPLETED";
    doc.completedAt = now;
    return { ok: true as const, start, estimate: doc.estimate.map((e) => ({ userId: e.userId.toString(), ticket: e.ticket, fnb: e.fnb, other: e.other })) };
  });
  if (!result.ok) return result;
  for (const e of result.estimate) {
    for (const category of EXPENSE_CATEGORIES) {
      if (e[category] <= 0) continue;
      await Expense.updateOne({ appointmentId: id, userId: e.userId, category }, { $setOnInsert: { amount: e[category], date: result.start } }, { upsert: true });
    }
  }
  await syncActualCost(id);
  return { ok: true };
}

export const personCostSchema = z.object({
  userId: objectId,
  ticket: z.number().int().min(0).max(100_000_000),
  fnb: z.number().int().min(0).max(100_000_000),
  other: z.number().int().min(0).max(100_000_000),
  /** Why the person changed their amount. */
  note: z.string().trim().max(200).optional(),
});
export type PersonCostInput = z.infer<typeof personCostSchema>;

/** Sets what one person's viewing cost. The creator can do it for anyone going; each person can do it for themselves. */
export async function setPersonCost(actorId: string, id: string, input: PersonCostInput): Promise<{ ok: true } | Failure> {
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const doc = await Appointment.findById(id).lean();
  if (!doc) return { ok: false, error: "not_found" };
  const attendees = attendeeIdsOf(doc as never);
  const isCreator = sameId(doc.creatorId, actorId);
  if (!isCreator && !attendees.includes(actorId)) return { ok: false, error: "not_found" };
  if (!isCreator && input.userId !== actorId) return { ok: false, error: "forbidden" };
  if (doc.status !== "COMPLETED") return { ok: false, error: "bad_state" };
  if (!attendees.includes(input.userId)) return { ok: false, error: "not_attendee" };
  const date = doc.timeOptions.find((o) => sameId(o._id, doc.chosenOptionId?.toString() ?? ""))?.startAt ?? doc.completedAt ?? new Date();

  for (const category of EXPENSE_CATEGORIES) {
    const amount = input[category];
    if (amount > 0) {
      await Expense.updateOne({ appointmentId: id, userId: input.userId, category }, { $set: { amount, date, ...(input.note ? { note: input.note } : {}) } }, { upsert: true });
    } else {
      await Expense.deleteOne({ appointmentId: id, userId: input.userId, category });
    }
  }
  await syncActualCost(id);
  return { ok: true };
}

export interface CostView {
  userId: string;
  ticket: number;
  fnb: number;
  other: number;
  total: number;
  note?: string;
}

/** Everyone's real cost of a finished appointment, and the group's total (which is their sum). */
export async function getCosts(id: string): Promise<{ perUser: CostView[]; totals: ReturnType<typeof sumCosts> }> {
  const rows = await Expense.find({ appointmentId: id }).lean();
  const byUser = new Map<string, CostView>();
  for (const r of rows) {
    const key = r.userId.toString();
    const row = byUser.get(key) ?? { userId: key, ticket: 0, fnb: 0, other: 0, total: 0 };
    row[r.category] += r.amount;
    row.total += r.amount;
    if (r.note) row.note = r.note;
    byUser.set(key, row);
  }
  const perUser = [...byUser.values()];
  return { perUser, totals: sumCosts(perUser) };
}

export { loadSeatPrices };
