import { z } from "zod";
import {
  objectIdField, optionalDate, optionalInt, optionalText, requiredInt, validRange,
} from "@/lib/validation/fields";
import { PriceRule } from "@/models/price-rule";
import { DAY_TYPES } from "@/services/pricing/ticket-price";
import { createMasterDataService } from "./crud";

/** A select that can also say "any": the form sends "any" (or nothing) for no condition. */
const noneIfAny = (value: string | undefined) => (value === undefined || value === "any" ? undefined : value);
const anyRef = z.string().optional().transform(noneIfAny).pipe(objectIdField.optional());
const anyDayType = z.string().optional().transform(noneIfAny).pipe(z.enum(DAY_TYPES, { error: "invalid" }).optional());

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = z.string().regex(TIME, { error: "invalid" }).optional();

export const priceRuleInputSchema = z
  .object({
    /** "brand:<id>" or "branch:<id>". */
    scope: z.string({ error: "required" }).regex(/^(brand|branch):[0-9a-fA-F]{24}$/, { error: "invalid" }),
    formatId: anyRef,
    seatTypeId: anyRef,
    dayType: anyDayType,
    weekday: optionalInt(0, 6),
    timeFrom: time,
    timeTo: time,
    price: requiredInt(0, 10_000_000),
    priority: optionalInt(0, 100),
    validFrom: optionalDate,
    validTo: optionalDate,
    note: optionalText(80),
  })
  .superRefine((value, ctx) => {
    validRange(value, ctx);
    if (value.dayType === "promo" && value.weekday === undefined) {
      ctx.addIssue({ code: "custom", path: ["weekday"], message: "required" });
    }
    if (value.timeFrom !== undefined && value.timeTo === undefined) ctx.addIssue({ code: "custom", path: ["timeTo"], message: "required" });
    if (value.timeTo !== undefined && value.timeFrom === undefined) ctx.addIssue({ code: "custom", path: ["timeFrom"], message: "required" });
    // Only compare two valid times: "8:00" is already reported as invalid on its own.
    if (value.timeFrom && value.timeTo && TIME.test(value.timeFrom) && TIME.test(value.timeTo) && value.timeTo <= value.timeFrom) {
      ctx.addIssue({ code: "custom", path: ["timeTo"], message: "out_of_range" });
    }
  })
  .transform(({ scope, weekday, priority, ...rest }) => {
    const [kind, id] = scope.split(":") as ["brand" | "branch", string];
    return {
      ...rest,
      brandId: kind === "brand" ? id : undefined,
      branchId: kind === "branch" ? id : undefined,
      // Only a promotion day has a weekday.
      weekday: rest.dayType === "promo" ? weekday : undefined,
      priority: priority ?? 0,
    };
  });

export type PriceRuleInput = z.infer<typeof priceRuleInputSchema>;

export const priceRuleService = createMasterDataService({
  entity: "priceRule",
  model: PriceRule,
  searchFields: ["note"],
  sort: { createdAt: -1 },
  editableFields: [
    "brandId", "branchId", "formatId", "seatTypeId", "dayType", "weekday", "timeFrom", "timeTo",
    "price", "priority", "validFrom", "validTo", "note",
  ],
  dependents: () => [],
});
