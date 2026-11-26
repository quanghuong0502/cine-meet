import { z } from "zod";
import { DEFAULT_SEAT_3D_COLOR } from "@/lib/seat-layout/scene";
import { SEAT_STYLES, type SeatStyle } from "@/lib/seat-layout/types";
import { optionalColor, optionalText, requiredText } from "@/lib/validation/fields";
import { AuditoriumLayout } from "@/models/auditorium-layout";
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
  style: z
    .preprocess((v) => (v === "" || v === undefined || v === null ? "standard" : v), z.enum(SEAT_STYLES, { error: "invalid" }))
    .transform((v) => v as SeatStyle),
  color: optionalColor,
  color3d: optionalColor.default(DEFAULT_SEAT_3D_COLOR),
});

export const seatTypeService = createMasterDataService({
  entity: "seatType",
  model: SeatType,
  searchFields: ["name", "nameEn"],
  sort: { capacity: 1, name: 1 },
  editableFields: ["name", "nameEn", "capacity", "style", "color", "color3d"],
  // Layouts store seat type ids as strings (in each seat and as the room's default type).
  dependents: () => [
    { model: PriceRule, field: "seatTypeId" },
    { model: AuditoriumLayout, field: "seats.type" },
    { model: AuditoriumLayout, field: "config.defaultSeatType" },
  ],
});
