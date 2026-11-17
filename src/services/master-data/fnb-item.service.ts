import { z } from "zod";
import {
  objectIdField, optionalDate, optionalText, requiredInt, requiredText, validRange,
} from "@/lib/validation/fields";
import { FnbCombo } from "@/models/fnb-combo";
import { FnbItem } from "@/models/fnb-item";
import { createMasterDataService } from "./crud";

export const fnbItemInputSchema = z
  .object({
    brandId: objectIdField,
    name: requiredText(80),
    nameEn: optionalText(80),
    size: optionalText(30),
    price: requiredInt(0, 10_000_000),
    validFrom: optionalDate,
    validTo: optionalDate,
  })
  .superRefine(validRange);

export const fnbItemService = createMasterDataService({
  entity: "fnbItem",
  model: FnbItem,
  searchFields: ["name", "nameEn"],
  sort: { name: 1, size: 1 },
  editableFields: ["brandId", "name", "nameEn", "size", "price", "validFrom", "validTo"],
  // An item that a combo contains cannot be deleted.
  dependents: () => [{ model: FnbCombo, field: "items.itemId" }],
});
