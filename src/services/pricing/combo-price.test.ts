import { describe, expect, it } from "vitest";
import { comboPrice, discountProblem } from "./combo-price";

const lines = [
  { price: 69_000, quantity: 1 }, // popcorn
  { price: 35_000, quantity: 2 }, // two drinks
];

describe("comboPrice", () => {
  it("is the sum of the items times their quantity when there is no discount", () => {
    expect(comboPrice(lines, { type: "amount", value: 0 })).toEqual({ subtotal: 139_000, discount: 0, price: 139_000 });
  });

  it("takes off a discount in dong", () => {
    expect(comboPrice(lines, { type: "amount", value: 19_000 })).toEqual({ subtotal: 139_000, discount: 19_000, price: 120_000 });
  });

  it("takes off a percentage, rounded to whole dong", () => {
    expect(comboPrice(lines, { type: "percent", value: 10 })).toEqual({ subtotal: 139_000, discount: 13_900, price: 125_100 });
    expect(comboPrice([{ price: 33_333, quantity: 1 }], { type: "percent", value: 10 }).discount).toBe(3_333);
  });

  it("never goes below zero", () => {
    expect(comboPrice(lines, { type: "amount", value: 500_000 }).price).toBe(0);
    expect(comboPrice(lines, { type: "percent", value: 100 }).price).toBe(0);
  });

  it("is zero with no items", () => {
    expect(comboPrice([], { type: "amount", value: 0 })).toEqual({ subtotal: 0, discount: 0, price: 0 });
  });
});

describe("discountProblem", () => {
  it("accepts a discount that fits", () => {
    expect(discountProblem(139_000, { type: "amount", value: 139_000 })).toBeNull();
    expect(discountProblem(139_000, { type: "percent", value: 100 })).toBeNull();
  });

  it("refuses more than the subtotal, a percentage over 100, and a negative or invalid value", () => {
    expect(discountProblem(139_000, { type: "amount", value: 139_001 })).toBe("discount_too_high");
    expect(discountProblem(139_000, { type: "percent", value: 101 })).toBe("out_of_range");
    expect(discountProblem(139_000, { type: "amount", value: -1 })).toBe("out_of_range");
    expect(discountProblem(139_000, { type: "percent", value: Number.NaN })).toBe("out_of_range");
  });
});
