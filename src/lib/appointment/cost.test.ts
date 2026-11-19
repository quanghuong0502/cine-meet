import { describe, expect, it } from "vitest";
import { estimateCosts, splitEvenly, sumCosts, ticketShares } from "./cost";

describe("ticketShares", () => {
  it("gives one holder the whole price", () => {
    expect(ticketShares(100_000, ["a"]).get("a")).toBe(100_000);
  });
  it("splits a couple seat and keeps the odd dong", () => {
    const shares = ticketShares(150_001, ["a", "b"]);
    expect(shares.get("a")).toBe(75_001);
    expect(shares.get("b")).toBe(75_000);
  });
  it("does nothing for an empty seat", () => {
    expect(ticketShares(100_000, []).size).toBe(0);
  });
});

describe("splitEvenly", () => {
  it("always adds back to the whole", () => {
    const parts = [...splitEvenly(100_000, ["a", "b", "c"]).values()];
    expect(parts.reduce((s, n) => s + n, 0)).toBe(100_000);
  });
});

describe("estimateCosts", () => {
  it("adds ticket, own food and an even part of shared food", () => {
    const { perUser, totals } = estimateCosts({
      attendeeIds: ["a", "b"],
      seats: [
        { seatCode: "D1", price: 90_000, holderIds: ["a"] },
        { seatCode: "D2", price: 110_000, holderIds: ["b"] },
      ],
      food: [
        { ownerId: "a", unitPrice: 30_000, quantity: 2 },
        { unitPrice: 100_000, quantity: 1 },
      ],
    });
    expect(perUser.find((p) => p.userId === "a")).toMatchObject({ ticket: 90_000, fnb: 110_000, total: 200_000 });
    expect(perUser.find((p) => p.userId === "b")).toMatchObject({ ticket: 110_000, fnb: 50_000, total: 160_000 });
    expect(totals.total).toBe(360_000);
  });
  it("counts a person without a seat as no ticket", () => {
    const { perUser } = estimateCosts({ attendeeIds: ["a"], seats: [], food: [] });
    expect(perUser[0]).toMatchObject({ ticket: 0, total: 0 });
  });
});

describe("sumCosts", () => {
  it("totals every category", () => {
    expect(sumCosts([{ ticket: 1, fnb: 2, other: 3 }, { ticket: 4, fnb: 5, other: 6 }])).toEqual({ ticket: 5, fnb: 7, other: 9, total: 21 });
  });
});
