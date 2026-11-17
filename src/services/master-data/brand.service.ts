import { z } from "zod";
import { optionalColor, optionalUrl, requiredText } from "@/lib/validation/fields";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { FnbCombo } from "@/models/fnb-combo";
import { FnbItem } from "@/models/fnb-item";
import { createMasterDataService } from "./crud";

export const brandInputSchema = z.object({
  name: requiredText(60),
  logoUrl: optionalUrl,
  color: optionalColor,
  websiteUrl: optionalUrl,
  appUrl: optionalUrl,
});

export type BrandInput = z.infer<typeof brandInputSchema>;

export const brandService = createMasterDataService({
  entity: "brand",
  model: Brand,
  searchFields: ["name"],
  sort: { name: 1 },
  editableFields: ["name", "logoUrl", "color", "websiteUrl", "appUrl"],
  // A brand with branches or food items still in use cannot be deleted.
  dependents: () => [
    { model: Branch, field: "brandId" },
    { model: FnbItem, field: "brandId" },
    { model: FnbCombo, field: "brandId" },
  ],
});
