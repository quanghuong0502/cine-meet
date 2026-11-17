import { z } from "zod";
import { optionalText, requiredDate, requiredText } from "@/lib/validation/fields";
import { Holiday } from "@/models/holiday";
import { createMasterDataService } from "./crud";

export const holidayInputSchema = z.object({
  date: requiredDate,
  name: requiredText(80),
  nameEn: optionalText(80),
});

export const holidayService = createMasterDataService({
  entity: "holiday",
  model: Holiday,
  searchFields: ["name", "nameEn", "date"],
  sort: { date: -1 },
  editableFields: ["date", "name", "nameEn"],
  dependents: () => [],
});
