import { z } from "zod";
import { optionalText, requiredText } from "@/lib/validation/fields";
import { Genre } from "@/models/genre";
import { createMasterDataService } from "./crud";

export const genreInputSchema = z.object({
  name: requiredText(40),
  nameEn: optionalText(40),
});

export const genreService = createMasterDataService({
  entity: "genre",
  model: Genre,
  searchFields: ["name", "nameEn"],
  sort: { name: 1 },
  editableFields: ["name", "nameEn"],
  // Movies will point at genres: added with Sprint 3.
  dependents: () => [],
});
