/**
 * Money of one appointment, worked out from plain numbers (no database), so the screen and the server agree and tests cover it.
 * Whole dong. The app only records what a viewing costs; it never tracks who paid or who owes (design 3.4).
 */

export const EXPENSE_CATEGORIES = ["ticket", "fnb", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface PersonCost {
  userId: string;
  ticket: number;
  fnb: number;
  other: number;
  total: number;
}

export interface CostTotals {
  ticket: number;
  fnb: number;
  other: number;
  total: number;
}

/** A food line: `ownerId` set means that person's own, missing means shared by the whole group. */
export interface FnbLineLike {
  ownerId?: string | null;
  unitPrice: number;
  quantity: number;
}

/** A seat held by one or two people. A couple seat has one price for both, split evenly (the first person pays the odd dong). */
export function ticketShares(price: number, holderIds: readonly string[]): Map<string, number> {
  const shares = new Map<string, number>();
  if (holderIds.length === 0) return shares;
  const base = Math.floor(price / holderIds.length);
  const rest = price - base * holderIds.length;
  holderIds.forEach((id, index) => shares.set(id, base + (index < rest ? 1 : 0)));
  return shares;
}

/** Splits an amount evenly across people, the first ones taking the odd dong, so the parts always add back to the whole. */
export function splitEvenly(amount: number, ids: readonly string[]): Map<string, number> {
  return ticketShares(amount, ids);
}

/**
 * The estimate for each attendee: their ticket (the price of their seat, shared on a couple seat), plus their own food and an even
 * part of the shared food. People without a seat yet have a ticket of 0.
 */
export function estimateCosts(input: {
  attendeeIds: readonly string[];
  /** Price of each seat code in the showtime, and who holds it. */
  seats: readonly { seatCode: string; price: number; holderIds: readonly string[] }[];
  food: readonly FnbLineLike[];
}): { perUser: PersonCost[]; totals: CostTotals } {
  const ticket = new Map<string, number>();
  for (const seat of input.seats) for (const [id, share] of ticketShares(seat.price, seat.holderIds)) ticket.set(id, (ticket.get(id) ?? 0) + share);

  const fnb = new Map<string, number>();
  const shared = input.food.filter((line) => !line.ownerId).reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  for (const line of input.food) {
    if (line.ownerId) fnb.set(line.ownerId, (fnb.get(line.ownerId) ?? 0) + line.unitPrice * line.quantity);
  }
  for (const [id, share] of splitEvenly(shared, input.attendeeIds)) fnb.set(id, (fnb.get(id) ?? 0) + share);

  const perUser = input.attendeeIds.map((userId): PersonCost => {
    const t = ticket.get(userId) ?? 0;
    const f = fnb.get(userId) ?? 0;
    return { userId, ticket: t, fnb: f, other: 0, total: t + f };
  });
  return { perUser, totals: sumCosts(perUser) };
}

export function sumCosts(rows: readonly Pick<PersonCost, "ticket" | "fnb" | "other">[]): CostTotals {
  const ticket = rows.reduce((s, r) => s + r.ticket, 0);
  const fnb = rows.reduce((s, r) => s + r.fnb, 0);
  const other = rows.reduce((s, r) => s + r.other, 0);
  return { ticket, fnb, other, total: ticket + fnb + other };
}
