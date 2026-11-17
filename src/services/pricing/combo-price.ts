/**
 * Price of a food combo: the sum of its items (current price x quantity) minus a discount. Pure (no database), so the form shows
 * the same number the server computes. Money is whole dong.
 */

export const DISCOUNT_TYPES = ["amount", "percent"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface ComboLine {
  /** The item's price in dong. */
  price: number;
  quantity: number;
}

export interface ComboDiscount {
  type: DiscountType;
  /** Dong for `amount`, 0 to 100 for `percent`. */
  value: number;
}

export interface ComboPrice {
  subtotal: number;
  /** What is taken off, in dong (never more than the subtotal). */
  discount: number;
  price: number;
}

/** Why a discount cannot be used for this combo, or null when it is fine. */
export function discountProblem(subtotal: number, discount: ComboDiscount): "out_of_range" | "discount_too_high" | null {
  if (!Number.isFinite(discount.value) || discount.value < 0) return "out_of_range";
  if (discount.type === "percent") return discount.value > 100 ? "out_of_range" : null;
  return discount.value > subtotal ? "discount_too_high" : null;
}

export function comboPrice(lines: readonly ComboLine[], discount: ComboDiscount): ComboPrice {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const raw = discount.type === "percent" ? Math.round((subtotal * discount.value) / 100) : Math.round(discount.value);
  const taken = Math.min(subtotal, Math.max(0, raw));
  return { subtotal, discount: taken, price: subtotal - taken };
}
