/**
 * Ticket price for one seat of one showtime, chosen from the price rules (design 2.1). Pure: no database, no clock,
 * so every rule of the choice is covered by tests. Times follow Vietnam (UTC+7, no daylight saving).
 */

export const DAY_TYPES = ["normal", "weekend", "holiday", "promo"] as const;
export type DayType = (typeof DAY_TYPES)[number];

export interface PriceRule {
  id: string;
  /** Exactly one of the two: the rule is for a whole brand or for a single branch. */
  brandId?: string;
  branchId?: string;
  formatId?: string;
  seatTypeId?: string;
  dayType?: DayType;
  /** For `promo` days: which weekday (0 = Sunday ... 6 = Saturday) is the promotion day. */
  weekday?: number;
  /** The showtime must START within [timeFrom, timeTo), "HH:mm". Both or neither. */
  timeFrom?: string;
  timeTo?: string;
  price: number;
  priority: number;
  /** Vietnam calendar days YYYY-MM-DD, inclusive; empty means open-ended. */
  validFrom?: string;
  validTo?: string;
  createdAt: Date;
}

export interface ShowtimeContext {
  startAt: Date;
  brandId: string;
  branchId: string;
  formatId: string;
  seatTypeId: string;
}

export type PriceResult =
  | { price: number; source: "override" }
  | { price: number; source: "rule"; ruleId: string };

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Day, time and weekday of an instant in Vietnam. */
export function vietnamParts(instant: Date): { date: string; time: string; weekday: number } {
  const local = new Date(instant.getTime() + VIETNAM_OFFSET_MS);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), weekday: local.getUTCDay() };
}

/** Higher wins when two rules tie on how specific they are: holiday > promo > weekend > normal > not stated. */
const DAY_RANK: Record<DayType, number> = { holiday: 4, promo: 3, weekend: 2, normal: 1 };

function matchesDay(rule: PriceRule, day: { date: string; weekday: number }, holidays: ReadonlySet<string>): boolean {
  switch (rule.dayType) {
    case undefined:
    case "normal": // the baseline: every day counts as a normal day too, so it is the fallback on holidays and weekends
      return true;
    case "holiday":
      return holidays.has(day.date);
    case "weekend":
      return day.weekday === 0 || day.weekday === 6;
    case "promo":
      return rule.weekday === day.weekday;
  }
}

function matches(rule: PriceRule, showtime: ShowtimeContext, day: ReturnType<typeof vietnamParts>, holidays: ReadonlySet<string>): boolean {
  if (rule.branchId !== undefined ? rule.branchId !== showtime.branchId : rule.brandId !== showtime.brandId) return false;
  if (rule.formatId !== undefined && rule.formatId !== showtime.formatId) return false;
  if (rule.seatTypeId !== undefined && rule.seatTypeId !== showtime.seatTypeId) return false;
  if (rule.validFrom !== undefined && day.date < rule.validFrom) return false;
  if (rule.validTo !== undefined && day.date > rule.validTo) return false;
  if (rule.timeFrom !== undefined && rule.timeTo !== undefined && (day.time < rule.timeFrom || day.time >= rule.timeTo)) return false;
  return matchesDay(rule, day, holidays);
}

/** Step 1 of the choice: a branch rule beats a brand rule, then the more conditions a rule states the better. */
function specificity(rule: PriceRule): [number, number] {
  const conditions =
    (rule.formatId !== undefined ? 1 : 0) +
    (rule.seatTypeId !== undefined ? 1 : 0) +
    (rule.dayType !== undefined ? 1 : 0) +
    (rule.timeFrom !== undefined ? 1 : 0);
  return [rule.branchId !== undefined ? 1 : 0, conditions];
}

/** Negative when `a` should win over `b`. Order: specificity, day type, priority (larger wins), newer rule. */
function compare(a: PriceRule, b: PriceRule): number {
  const [aScope, aConditions] = specificity(a);
  const [bScope, bConditions] = specificity(b);
  return (
    bScope - aScope ||
    bConditions - aConditions ||
    (b.dayType ? DAY_RANK[b.dayType] : 0) - (a.dayType ? DAY_RANK[a.dayType] : 0) ||
    b.priority - a.priority ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    // Last resort so the answer never depends on the order the rules arrive in.
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * The price for a seat in a showtime, or null when no rule applies (the admin has not priced it yet).
 * A showtime with `priceOverride` uses it and ignores every rule.
 */
export function resolveTicketPrice(input: {
  showtime: ShowtimeContext;
  rules: readonly PriceRule[];
  /** Holiday dates YYYY-MM-DD. */
  holidays: ReadonlySet<string>;
  priceOverride?: number;
}): PriceResult | null {
  if (input.priceOverride !== undefined) return { price: input.priceOverride, source: "override" };

  const day = vietnamParts(input.showtime.startAt);
  const candidates = input.rules.filter((rule) => matches(rule, input.showtime, day, input.holidays));
  const winner = candidates.sort(compare)[0];
  return winner ? { price: winner.price, source: "rule", ruleId: winner.id } : null;
}
