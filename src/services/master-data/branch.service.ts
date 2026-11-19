import { z } from "zod";
import { checkbox, objectIdField, optionalInt, optionalText, optionalUrl, requiredText } from "@/lib/validation/fields";
import { Branch } from "@/models/branch";
import { PriceRule } from "@/models/price-rule";
import { createMasterDataService } from "./crud";

export const branchInputSchema = z
  .object({
    brandId: objectIdField,
    name: requiredText(80),
    address: optionalText(200),
    mapsUrl: optionalUrl,
    imageUrl: optionalUrl,
    floor: optionalText(40),
    openingHours: optionalText(60),
    parkingFee: optionalInt(0, 1_000_000),
    parkingLocation: optionalText(120),
    parkingEntrance: optionalText(120),
    active: checkbox,
  });

export type BranchInput = z.infer<typeof branchInputSchema>;

export const branchService = createMasterDataService({
  entity: "branch",
  model: Branch,
  searchFields: ["name", "address"],
  sort: { name: 1 },
  editableFields: [
    "brandId", "name", "address", "mapsUrl", "imageUrl", "floor", "openingHours",
    "parkingFee", "parkingLocation", "parkingEntrance", "active",
  ],
  // Auditoriums will point at a branch too (Sprint 2).
  dependents: () => [{ model: PriceRule, field: "branchId" }],
});
