import { z } from "zod";
import { checkbox, optionalText, requiredText } from "@/lib/validation/fields";
import { FnbCategory } from "@/models/fnb-category";
import { FnbItem } from "@/models/fnb-item";
import { createMasterDataService } from "./crud";

export const fnbCategoryInputSchema = z.object({
  name: requiredText(40),
  nameEn: optionalText(40),
  active: checkbox,
});

export const fnbCategoryService = createMasterDataService({
  entity: "fnbCategory",
  model: FnbCategory,
  searchFields: ["name", "nameEn"],
  sort: { name: 1 },
  editableFields: ["name", "nameEn", "active"],
  // A category that items still use cannot be deleted.
  dependents: () => [{ model: FnbItem, field: "categoryId" }],
});
