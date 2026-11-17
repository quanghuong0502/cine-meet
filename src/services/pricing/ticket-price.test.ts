import { describe, expect, it } from "vitest";
import { resolveTicketPrice, vietnamParts, type PriceRule, type ShowtimeContext } from "./ticket-price";

const BRAND = "brand-cgv";
const BRANCH = "branch-vincom";
const OTHER_BRANCH = "branch-other";

/** 19:30 Vietnam time on the given day = 12:30 UTC. */
const at = (date: string, time = "19:30") => new Date(`${date}T${time}:00+07:00`);

// 2026-03-04 is a Wednesday, 03-07 a Saturday, 03-08 a Sunday.
const WED = "2026-03-04";
const SAT = "2026-03-07";

function showtime(date: string, time?: string, extra: Partial<ShowtimeContext> = {}): ShowtimeContext {
  return { startAt: at(date, time), brandId: BRAND, branchId: BRANCH, formatId: "2d", seatTypeId: "standard", ...extra };
}

let counter = 0;
function rule(extra: Partial<PriceRule> & { price: number }): PriceRule {
  counter += 1;
  return { id: `r${counter}`, brandId: BRAND, priority: 0, createdAt: new Date(2026, 0, counter), ...extra };
}

const price = (rules: PriceRule[], st: ShowtimeContext, holidays: string[] = [], priceOverride?: number) =>
  resolveTicketPrice({ showtime: st, rules, holidays: new Set(holidays), priceOverride });

describe("vietnamParts", () => {
  it("reads the day, time and weekday in Vietnam, not UTC", () => {
    // 23:30 UTC on 03-06 is 06:30 on 03-07 in Vietnam.
    expect(vietnamParts(new Date("2026-03-06T23:30:00Z"))).toEqual({ date: "2026-03-07", time: "06:30", weekday: 6 });
    expect(vietnamParts(at(WED))).toEqual({ date: WED, time: "19:30", weekday: 3 });
  });
});

describe("resolveTicketPrice", () => {
  it("returns null when no rule applies", () => {
    expect(price([], showtime(WED))).toBeNull();
    expect(price([rule({ price: 90000, brandId: "other-brand" })], showtime(WED))).toBeNull();
  });

  it("uses a plain brand rule on any day", () => {
    expect(price([rule({ price: 90000 })], showtime(WED))).toMatchObject({ price: 90000, source: "rule" });
  });

  it("a showtime override bypasses every rule", () => {
    expect(price([rule({ price: 90000 })], showtime(WED), [], 50000)).toEqual({ price: 50000, source: "override" });
    expect(price([], showtime(WED), [], 0)).toEqual({ price: 0, source: "override" });
  });

  it("prices normal days and weekends apart", () => {
    const rules = [rule({ price: 80000, dayType: "normal" }), rule({ price: 100000, dayType: "weekend" })];
    expect(price(rules, showtime(WED))?.price).toBe(80000);
    expect(price(rules, showtime(SAT))?.price).toBe(100000);
    expect(price(rules, showtime("2026-03-08"))?.price).toBe(100000);
  });

  it("a holiday beats the weekend, and falls back to normal when there is no holiday rule", () => {
    const rules = [
      rule({ price: 80000, dayType: "normal" }),
      rule({ price: 100000, dayType: "weekend" }),
      rule({ price: 120000, dayType: "holiday" }),
    ];
    expect(price(rules, showtime(SAT), [SAT])?.price).toBe(120000);
    expect(price(rules, showtime(WED), [WED])?.price).toBe(120000);
    expect(price([rules[0]!], showtime(WED), [WED])?.price).toBe(80000);
  });

  it("a promo weekday beats weekend and normal, but not a holiday", () => {
    const promo = rule({ price: 60000, dayType: "promo", weekday: 3 });
    const normal = rule({ price: 80000, dayType: "normal" });
    const holiday = rule({ price: 120000, dayType: "holiday" });
    expect(price([normal, promo], showtime(WED))?.price).toBe(60000);
    expect(price([normal, promo], showtime("2026-03-05"))?.price).toBe(80000); // Thursday
    expect(price([normal, promo, holiday], showtime(WED), [WED])?.price).toBe(120000);
  });

  it("a branch rule beats a brand rule", () => {
    const brandRule = rule({ price: 90000 });
    const branchRule = rule({ price: 110000, brandId: undefined, branchId: BRANCH });
    expect(price([brandRule, branchRule], showtime(WED))?.price).toBe(110000);
    expect(price([branchRule, brandRule], showtime(WED))?.price).toBe(110000);
    // A branch rule for another branch does not apply.
    const otherBranch = rule({ price: 70000, brandId: undefined, branchId: OTHER_BRANCH });
    expect(price([brandRule, otherBranch], showtime(WED))?.price).toBe(90000);
  });

  it("a branch rule beats a more detailed brand rule (scope is decided first)", () => {
    const detailed = rule({ price: 95000, formatId: "2d", seatTypeId: "standard", dayType: "normal" });
    const branchRule = rule({ price: 110000, brandId: undefined, branchId: BRANCH });
    expect(price([detailed, branchRule], showtime(WED))?.price).toBe(110000);
  });

  it("a rule with more conditions beats one with fewer", () => {
    const any = rule({ price: 90000 });
    const forFormat = rule({ price: 95000, formatId: "2d" });
    const forFormatAndSeat = rule({ price: 99000, formatId: "2d", seatTypeId: "standard" });
    expect(price([any, forFormat, forFormatAndSeat], showtime(WED))?.price).toBe(99000);
    expect(price([any, forFormat, forFormatAndSeat], showtime(WED, undefined, { seatTypeId: "vip" }))?.price).toBe(95000);
    expect(price([any, forFormat, forFormatAndSeat], showtime(WED, undefined, { formatId: "imax" }))?.price).toBe(90000);
  });

  it("matches a time slot by the start time, end excluded", () => {
    const matinee = rule({ price: 60000, timeFrom: "08:00", timeTo: "12:00" });
    const base = rule({ price: 90000 });
    expect(price([base, matinee], showtime(WED, "08:00"))?.price).toBe(60000);
    expect(price([base, matinee], showtime(WED, "11:59"))?.price).toBe(60000);
    expect(price([base, matinee], showtime(WED, "12:00"))?.price).toBe(90000);
    expect(price([base, matinee], showtime(WED, "07:59"))?.price).toBe(90000);
  });

  it("skips a rule outside its validity, inclusive of both ends", () => {
    const old = rule({ price: 70000, validTo: "2026-03-03" });
    const current = rule({ price: 90000, validFrom: "2026-03-04", validTo: "2026-03-04" });
    expect(price([old, current], showtime(WED))?.price).toBe(90000);
    expect(price([old, current], showtime("2026-03-05"))).toBeNull();
    expect(price([old, current], showtime("2026-03-03"))?.price).toBe(70000);
  });

  it("uses the Vietnam day for validity near midnight", () => {
    // 00:30 on 03-05 in Vietnam is still 03-04 in UTC.
    const rules = [rule({ price: 90000, validFrom: "2026-03-05" })];
    expect(price(rules, showtime("2026-03-05", "00:30"))?.price).toBe(90000);
    expect(price(rules, showtime("2026-03-04", "23:30"))).toBeNull();
  });

  it("priority breaks a tie, larger first", () => {
    const low = rule({ price: 90000, priority: 1 });
    const high = rule({ price: 85000, priority: 5 });
    expect(price([low, high], showtime(WED))?.price).toBe(85000);
  });

  it("when still tied, the rule created later wins, whatever the input order", () => {
    const older = rule({ price: 90000 });
    const newer = rule({ price: 95000 });
    expect(price([older, newer], showtime(WED))?.price).toBe(95000);
    expect(price([newer, older], showtime(WED))?.price).toBe(95000);
  });

  it("day type outranks priority", () => {
    const promo = rule({ price: 60000, dayType: "promo", weekday: 3, priority: 0 });
    const normal = rule({ price: 80000, dayType: "normal", priority: 99 });
    expect(price([normal, promo], showtime(WED))?.price).toBe(60000);
  });

  it("does not change the rules it is given", () => {
    const rules = [rule({ price: 1 }), rule({ price: 2 })];
    const copy = [...rules];
    price(rules, showtime(WED));
    expect(rules).toEqual(copy);
  });
});
