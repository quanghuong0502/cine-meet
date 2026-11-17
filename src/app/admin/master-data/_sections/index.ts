import type { MasterDataSectionKey } from "@/lib/master-data-sections";
import { ageRatingsSection } from "./age-ratings/section";
import { branchesSection } from "./branches/section";
import { brandsSection } from "./brands/section";
import { fnbCombosSection } from "./fnb-combos/section";
import { fnbItemsSection } from "./fnb-items/section";
import { formatsSection } from "./formats/section";
import { genresSection } from "./genres/section";
import { holidaysSection } from "./holidays/section";
import { seatTypesSection } from "./seat-types/section";
import type { SectionDefinition } from "./types";

/** Every master-data type, by key. Add an entry when a section is added to `MASTER_DATA_SECTIONS`. */
export const SECTIONS: Record<MasterDataSectionKey, SectionDefinition> = {
  brands: brandsSection,
  branches: branchesSection,
  genres: genresSection,
  formats: formatsSection,
  ageRatings: ageRatingsSection,
  seatTypes: seatTypesSection,
  holidays: holidaysSection,
  fnbItems: fnbItemsSection,
  fnbCombos: fnbCombosSection,
};
