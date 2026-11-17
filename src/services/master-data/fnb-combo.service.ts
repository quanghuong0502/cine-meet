import { z } from "zod";
import {
  objectIdField, optionalDate, requiredText, validRange,
} from "@/lib/validation/fields";
import { FnbCombo } from "@/models/fnb-combo";
import { FnbItem } from "@/models/fnb-item";
import { connectToDatabase } from "@/lib/db";
import { comboPrice, DISCOUNT_TYPES, discountProblem, type ComboDiscount, type ComboPrice } from "@/services/pricing/combo-price";
import { createMasterDataService, type ServiceError, type ServiceResult, type WithId } from "./crud";

export const MAX_COMBO_ITEMS = 20;
export const MAX_ITEM_QUANTITY = 20;

/** The form sends the items as JSON text: [{"itemId":"...","quantity":2}]. */
const itemsField = z
  .string({ error: "required" })
  .transform((text) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  })
  .pipe(
    z
      .array(
        z.object({
          itemId: objectIdField,
          quantity: z.number({ error: "invalid_number" }).int({ error: "invalid_number" }).min(1, { error: "out_of_range" }).max(MAX_ITEM_QUANTITY, { error: "out_of_range" }),
        }),
        { error: "invalid" },
      )
      .min(1, { error: "no_items" })
      .max(MAX_COMBO_ITEMS, { error: "out_of_range" })
      .refine((lines) => new Set(lines.map((line) => line.itemId)).size === lines.length, { error: "invalid" }),
  );

const discountValue = z
  .string()
  .transform((value) => Number(value))
  .pipe(z.number({ error: "invalid_number" }).int({ error: "invalid_number" }).min(0, { error: "out_of_range" }).max(10_000_000, { error: "out_of_range" }))
  .optional();

export const fnbComboInputSchema = z
  .object({
    brandId: objectIdField,
    name: requiredText(80),
    items: itemsField,
    discountType: z.enum(DISCOUNT_TYPES, { error: "invalid" }).optional(),
    discountValue,
    validFrom: optionalDate,
    validTo: optionalDate,
  })
  .superRefine(validRange)
  // A percentage cannot pass 100 (the dong amount is checked against the items' prices when it is saved).
  .superRefine((value, ctx) => {
    if (value.discountType === "percent" && (value.discountValue ?? 0) > 100) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "out_of_range" });
    }
  })
  .transform((value) => ({ ...value, discountType: value.discountType ?? "amount", discountValue: value.discountValue ?? 0 }));

export type FnbComboInput = z.infer<typeof fnbComboInputSchema>;

const base = createMasterDataService({
  entity: "fnbCombo",
  model: FnbCombo,
  searchFields: ["name"],
  sort: { name: 1 },
  editableFields: ["brandId", "name", "items", "discountType", "discountValue", "validFrom", "validTo"],
  dependents: () => [],
});

/**
 * The checks that need the database: every item exists and belongs to the combo's brand, and a discount in dong is not more than
 * the items cost. Returns the error code, or null when the combo can be saved.
 */
async function checkCombo(input: Record<string, unknown>): Promise<ServiceError | null> {
  const lines = (input.items ?? []) as Array<{ itemId: string; quantity: number }>;
  await connectToDatabase();
  const items = await FnbItem.find({ _id: { $in: lines.map((line) => line.itemId) }, brandId: input.brandId as string }).lean();
  if (items.length !== lines.length) return "item_invalid";

  const priceById = new Map(items.map((item) => [item._id.toString(), item.price]));
  const { subtotal } = comboPrice(
    lines.map((line) => ({ price: priceById.get(line.itemId) ?? 0, quantity: line.quantity })),
    { type: "amount", value: 0 },
  );
  const discount: ComboDiscount = { type: (input.discountType as ComboDiscount["type"]) ?? "amount", value: Number(input.discountValue ?? 0) };
  return discountProblem(subtotal, discount) === null ? null : "discount_too_high";
}

export const fnbComboService = {
  ...base,
  async create(input: Record<string, unknown>, actorId: string): Promise<ServiceResult<WithId<import("@/models/fnb-combo").FnbComboDoc>>> {
    const problem = await checkCombo(input);
    if (problem) return { ok: false, error: problem };
    return base.create(input, actorId);
  },
  async update(id: string, input: Record<string, unknown>, actorId: string): Promise<ServiceResult<WithId<import("@/models/fnb-combo").FnbComboDoc>>> {
    const problem = await checkCombo(input);
    if (problem) return { ok: false, error: problem };
    return base.update(id, input, actorId);
  },
};

/** What a combo costs now, from the current prices of its items; null when it has no items yet (a combo saved before items existed). */
export function priceOfCombo(
  combo: { items?: Array<{ itemId: { toString(): string }; quantity: number }> | null; discountType?: string | null; discountValue?: number | null },
  itemPrices: ReadonlyMap<string, number>,
): ComboPrice | null {
  if (!combo.items?.length) return null;
  return comboPrice(
    combo.items.map((line) => ({ price: itemPrices.get(line.itemId.toString()) ?? 0, quantity: line.quantity })),
    { type: combo.discountType === "percent" ? "percent" : "amount", value: combo.discountValue ?? 0 },
  );
}
