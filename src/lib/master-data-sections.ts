import { Building2, type LucideIcon } from "lucide-react";

/** Keys of `admin.masterData.sections.*` in src/messages/*.json. Add a section when its page exists. */
export type MasterDataSectionKey = "brands";

export interface MasterDataSection {
  key: MasterDataSectionKey;
  href: string;
  icon: LucideIcon;
}

export const MASTER_DATA_SECTIONS: MasterDataSection[] = [
  { key: "brands", href: "/admin/master-data/brands", icon: Building2 },
];
