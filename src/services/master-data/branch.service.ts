import { z } from "zod";
import { objectIdField, optionalInt, optionalText, optionalUrl, requiredText } from "@/lib/validation/fields";
import { Branch } from "@/models/branch";
import { createMasterDataService } from "./crud";

const coordinate = (min: number, max: number) =>
  z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number({ error: "invalid_number" }).min(min, { error: "out_of_range" }).max(max, { error: "out_of_range" }))
    .optional();

export const branchInputSchema = z
  .object({
    brandId: objectIdField,
    name: requiredText(80),
    address: optionalText(200),
    lat: coordinate(-90, 90),
    lng: coordinate(-180, 180),
    mapsUrl: optionalUrl,
    floor: optionalText(40),
    openingHours: optionalText(60),
    parkingFee: optionalInt(0, 1_000_000),
    parkingLocation: optionalText(120),
    parkingEntrance: optionalText(120),
  })
  // A point needs both coordinates.
  .superRefine((value, ctx) => {
    if (value.lat !== undefined && value.lng === undefined) ctx.addIssue({ code: "custom", path: ["lng"], message: "required" });
    if (value.lng !== undefined && value.lat === undefined) ctx.addIssue({ code: "custom", path: ["lat"], message: "required" });
  });

export type BranchInput = z.infer<typeof branchInputSchema>;

export const branchService = createMasterDataService({
  entity: "branch",
  model: Branch,
  searchFields: ["name", "address"],
  sort: { name: 1 },
  editableFields: [
    "brandId", "name", "address", "lat", "lng", "mapsUrl", "floor", "openingHours",
    "parkingFee", "parkingLocation", "parkingEntrance",
  ],
  // Auditoriums will point at a branch: added with Sprint 2.
  dependents: () => [],
});
