import { z } from "zod";
import {
  objectIdField, optionalDate, optionalText, requiredInt, requiredText, validRange,
} from "@/lib/validation/fields";
import { FnbCombo } from "@/models/fnb-combo";
import { createMasterDataService } from "./crud";

export const fnbComboInputSchema = z
  .object({
    brandId: objectIdField,
    name: requiredText(80),
    description: optionalText(300),
    price: requiredInt(0, 10_000_000),
    validFrom: optionalDate,
    validTo: optionalDate,
  })
  .superRefine(validRange);

export const fnbComboService = createMasterDataService({
  entity: "fnbCombo",
  model: FnbCombo,
  searchFields: ["name", "description"],
  sort: { name: 1 },
  editableFields: ["brandId", "name", "description", "price", "validFrom", "validTo"],
  dependents: () => [],
});
