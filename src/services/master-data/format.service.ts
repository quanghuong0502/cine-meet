import { z } from "zod";
import { requiredText } from "@/lib/validation/fields";
import { Format } from "@/models/format";
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
  // Showtimes and price rules will point at formats: added with Sprint 3.
  dependents: () => [],
});
