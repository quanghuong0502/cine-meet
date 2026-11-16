import { z } from "zod";
import { optionalColor, optionalUrl, requiredText } from "@/lib/validation/fields";
import { Brand } from "@/models/brand";
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
  // Branches will point at a brand: added when branches exist (Sprint 1, step 2).
  dependents: () => [],
});
