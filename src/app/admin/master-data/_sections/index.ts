import type { MasterDataSectionKey } from "@/lib/master-data-sections";
import { brandsSection } from "./brands/section";
import type { SectionDefinition } from "./types";

/** Every master-data type, by key. Add an entry when a section is added to `MASTER_DATA_SECTIONS`. */
export const SECTIONS: Record<MasterDataSectionKey, SectionDefinition> = {
  brands: brandsSection,
};
