import { z } from "zod";
import { checkbox, optionalText, requiredText } from "@/lib/validation/fields";
import { Movie } from "@/models/movie";
import { Genre } from "@/models/genre";
import { createMasterDataService } from "./crud";

export const genreInputSchema = z.object({
  name: requiredText(40),
  nameEn: optionalText(40),
  active: checkbox,
});

export const genreService = createMasterDataService({
  entity: "genre",
  model: Genre,
  searchFields: ["name", "nameEn"],
  sort: { name: 1 },
  editableFields: ["name", "nameEn", "active"],
  // Movies will point at genres: added with Sprint 3.
  dependents: () => [{ model: Movie, field: "genreIds" }],
});
