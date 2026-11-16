import type { MasterDataSectionKey } from "@/lib/master-data-sections";
import { BrandsSection } from "./brands/section";

/** Content of each tab on the Catalog page. Add an entry here when a section is added to `MASTER_DATA_SECTIONS`. */
export const SECTION_COMPONENTS: Record<MasterDataSectionKey, (props: { q: string }) => Promise<React.JSX.Element>> = {
  brands: BrandsSection,
};
