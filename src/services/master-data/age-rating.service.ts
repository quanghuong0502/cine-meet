import { z } from "zod";
import { optionalText, requiredInt, requiredText } from "@/lib/validation/fields";
import { AgeRating } from "@/models/age-rating";
import { createMasterDataService } from "./crud";

export const ageRatingInputSchema = z.object({
  code: requiredText(10),
  description: requiredText(120),
  descriptionEn: optionalText(120),
  minAge: requiredInt(0, 21),
});

export const ageRatingService = createMasterDataService({
  entity: "ageRating",
  model: AgeRating,
  searchFields: ["code", "description"],
  sort: { minAge: 1, code: 1 },
  editableFields: ["code", "description", "descriptionEn", "minAge"],
  // Movies will point at age ratings: added with Sprint 3.
  dependents: () => [],
});
