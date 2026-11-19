import type { Doc } from "@/services/appointment.service";
import { estimateCosts } from "@/lib/appointment/cost";
import { Auditorium } from "@/models/auditorium";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { Branch } from "@/models/branch";
import { SeatClaim } from "@/models/seat-claim";
import { Showtime } from "@/models/showtime";
import { loadPricing } from "@/services/showtime.service";
import { resolveTicketPrice } from "@/services/pricing/ticket-price";

/** The people going: the creator and everyone still in the list (the creator is never in `participants`). */
export function attendeeIdsOf(doc: Pick<Doc, "creatorId" | "participants">): string[] {
  return [doc.creatorId.toString(), ...doc.participants.filter((p) => p.status === "accepted").map((p) => p.userId.toString())];
}

export interface ShowtimeSeatInfo {
  seatCode: string;
  type: string;
  span: number;
  price: number | null;
}

/** The ticket price of every seat of a showtime (null when no price rule covers that seat type). */
export async function loadSeatPrices(showtimeId: string): Promise<Map<string, ShowtimeSeatInfo>> {
  const showtime = await Showtime.findById(showtimeId).lean();
  if (!showtime) return new Map();
  const [room, layout, pricing] = await Promise.all([Auditorium.findById(showtime.auditoriumId, "branchId").lean(), AuditoriumLayout.findById(showtime.layoutId, "seats").lean(), loadPricing()]);
  const branch = room ? await Branch.findById(room.branchId, "brandId").lean() : null;
  if (!room || !layout || !branch) return new Map();
  const byType = new Map<string, number | null>();
  const priceOf = (seatTypeId: string) => {
    if (!byType.has(seatTypeId)) {
      byType.set(
        seatTypeId,
        resolveTicketPrice({
          showtime: { startAt: showtime.startAt, brandId: branch.brandId.toString(), branchId: branch._id.toString(), formatId: showtime.formatId.toString(), seatTypeId },
          rules: pricing.rules,
          holidays: pricing.holidays,
          priceOverride: showtime.priceOverride ?? undefined,
        })?.price ?? null,
      );
    }
    return byType.get(seatTypeId) ?? null;
  };
  return new Map(layout.seats.map((s) => [s.code, { seatCode: s.code, type: s.type, span: s.span, price: priceOf(s.type) }]));
}

/** Works out each attendee's ticket and food and stores it on the document (the caller saves). A seat with no price counts as 0. */
export async function recomputeEstimate(doc: Doc): Promise<void> {
  const attendeeIds = attendeeIdsOf(doc);
  const prices = doc.showtimeId ? await loadSeatPrices(doc.showtimeId.toString()) : new Map<string, ShowtimeSeatInfo>();
  const holders = new Map<string, string[]>();
  for (const seat of doc.seats) {
    if (!attendeeIds.includes(seat.userId.toString())) continue;
    holders.set(seat.seatCode, [...(holders.get(seat.seatCode) ?? []), seat.userId.toString()]);
  }
  const { perUser } = estimateCosts({
    attendeeIds,
    seats: [...holders].map(([seatCode, holderIds]) => ({ seatCode, price: prices.get(seatCode)?.price ?? 0, holderIds })),
    food: doc.fnb.map((line) => ({ ownerId: line.ownerId?.toString() ?? null, unitPrice: line.unitPrice, quantity: line.quantity })),
  });
  doc.set("estimate", perUser.map((p) => ({ userId: p.userId, ticket: p.ticket, fnb: p.fnb, other: 0 })));
}

/** Gives back the seats of an appointment that its seat list no longer holds (someone left, the seat moved, it was cancelled). */
export async function releaseUnusedClaims(appointmentId: string, keepCodes: readonly string[]): Promise<void> {
  await SeatClaim.deleteMany({ appointmentId, seatCode: { $nin: [...keepCodes] } });
}
