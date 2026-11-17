import { z } from "zod";
import { optionalColor, optionalText, requiredText } from "@/lib/validation/fields";
import { PriceRule } from "@/models/price-rule";
import { SeatType } from "@/models/seat-type";
import { createMasterDataService } from "./crud";

export const seatTypeInputSchema = z.object({
  name: requiredText(40),
  nameEn: optionalText(40),
  capacity: z
    .string({ error: "required" })
    .pipe(z.enum(["1", "2"], { error: "invalid" }))
    .transform((value) => Number(value) as 1 | 2),
  color: optionalColor,
});

export const seatTypeService = createMasterDataService({
  entity: "seatType",
  model: SeatType,
  searchFields: ["name", "nameEn"],
  sort: { capacity: 1, name: 1 },
  editableFields: ["name", "nameEn", "capacity", "color"],
  // Seat maps will point at seat types too (Sprint 2).
  dependents: () => [{ model: PriceRule, field: "seatTypeId" }],
});
