import { z } from "zod";
import { requiredText } from "@/lib/validation/fields";
import { Format } from "@/models/format";
import { Movie } from "@/models/movie";
import { Showtime } from "@/models/showtime";
import { PriceRule } from "@/models/price-rule";
import { createMasterDataService } from "./crud";

export const formatInputSchema = z.object({
  name: requiredText(30),
});

export const formatService = createMasterDataService({
  entity: "format",
  model: Format,
  searchFields: ["name"],
  sort: { name: 1 },
  editableFields: ["name"],
  // Showtimes will point at formats too (Sprint 3).
  dependents: () => [
    { model: PriceRule, field: "formatId" },
    { model: Movie, field: "formatIds" },
    { model: Showtime, field: "formatId" },
  ],
});
