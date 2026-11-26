import type { Icon as SolarIcon } from "@solar-icons/react/lib/types";
import {
  Armchair2Icon, CakeIcon, CalendarMarkIcon, CrownStarIcon, CupPaperIcon, DonutBittenIcon, MapPointIcon, MasksIcon, Reel2Icon, ShieldCheckIcon, TicketSaleIcon,
} from "@solar-icons/react/line-duotone";

/** Tabs of the Catalog page. Keys of `admin.masterData.sections.*` in src/messages/*.json. Add one per master-data type. */
export type MasterDataSectionKey =
  | "brands"
  | "branches"
  | "genres"
  | "formats"
  | "ageRatings"
  | "seatTypes"
  | "holidays"
  | "fnbCategories"
  | "fnbItems"
  | "fnbCombos"
  | "priceRules";

export interface MasterDataSection {
  key: MasterDataSectionKey;
  /** Route segment of the entry screens: /admin/master-data/<slug>/new and /<id>. */
  slug: string;
  href: string;
  icon: SolarIcon;
}

export const MASTER_DATA_SECTIONS: MasterDataSection[] = [
  { key: "brands", slug: "brands", href: "/admin/master-data/brands", icon: CrownStarIcon },
  { key: "branches", slug: "branches", href: "/admin/master-data/branches", icon: MapPointIcon },
  { key: "genres", slug: "genres", href: "/admin/master-data/genres", icon: MasksIcon },
  { key: "formats", slug: "formats", href: "/admin/master-data/formats", icon: Reel2Icon },
  { key: "ageRatings", slug: "age-ratings", href: "/admin/master-data/age-ratings", icon: ShieldCheckIcon },
  { key: "seatTypes", slug: "seat-types", href: "/admin/master-data/seat-types", icon: Armchair2Icon },
  { key: "priceRules", slug: "price-rules", href: "/admin/master-data/price-rules", icon: TicketSaleIcon },
  { key: "holidays", slug: "holidays", href: "/admin/master-data/holidays", icon: CalendarMarkIcon },
  { key: "fnbCategories", slug: "fnb-categories", href: "/admin/master-data/fnb-categories", icon: CakeIcon },
  { key: "fnbItems", slug: "fnb-items", href: "/admin/master-data/fnb-items", icon: CupPaperIcon },
  { key: "fnbCombos", slug: "fnb-combos", href: "/admin/master-data/fnb-combos", icon: DonutBittenIcon },
];

/** The section whose entry screens live under /admin/master-data/<slug>, if any. */
export function sectionFromSlug(slug: string): MasterDataSection | undefined {
  return MASTER_DATA_SECTIONS.find((section) => section.slug === slug);
}
