import { z } from "zod";
import { ROOM_3D_PRESET_IDS } from "@/lib/seat-layout/room-3d-appearance.defaults";
import { checkbox, optionalColor, optionalUrl, requiredText } from "@/lib/validation/fields";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { FnbCombo } from "@/models/fnb-combo";
import { FnbItem } from "@/models/fnb-item";
import { PriceRule } from "@/models/price-rule";
import { createMasterDataService } from "./crud";

const optionalRoom3DPreset = z.preprocess(
  (value) => (typeof value === "string" && (value.trim() === "" || value === "none") ? undefined : value),
  z.enum(ROOM_3D_PRESET_IDS).optional(),
);

export const brandInputSchema = z.object({
  name: requiredText(60),
  logoUrl: optionalUrl,
  color: optionalColor,
  websiteUrl: optionalUrl,
  appUrl: optionalUrl,
  room3dPreset: optionalRoom3DPreset,
  active: checkbox,
});

export type BrandInput = z.infer<typeof brandInputSchema>;

export const brandService = createMasterDataService({
  entity: "brand",
  model: Brand,
  searchFields: ["name"],
  sort: { name: 1 },
  editableFields: ["name", "logoUrl", "color", "websiteUrl", "appUrl", "room3dPreset", "active"],
  // A brand with branches or food items still in use cannot be deleted.
  dependents: () => [
    { model: Branch, field: "brandId" },
    { model: FnbItem, field: "brandId" },
    { model: FnbCombo, field: "brandId" },
    { model: PriceRule, field: "brandId" },
  ],
});
