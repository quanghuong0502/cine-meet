import {
  Armchair, Building2, CalendarHeart, Clapperboard, Film, MapPin, Shapes, ShieldAlert, Tag, Ticket, UtensilsCrossed, type LucideIcon,
} from "lucide-react";

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
  icon: LucideIcon;
}

export const MASTER_DATA_SECTIONS: MasterDataSection[] = [
  { key: "brands", slug: "brands", href: "/admin/master-data/brands", icon: Building2 },
  { key: "branches", slug: "branches", href: "/admin/master-data/branches", icon: MapPin },
  { key: "genres", slug: "genres", href: "/admin/master-data/genres", icon: Clapperboard },
  { key: "formats", slug: "formats", href: "/admin/master-data/formats", icon: Film },
  { key: "ageRatings", slug: "age-ratings", href: "/admin/master-data/age-ratings", icon: ShieldAlert },
  { key: "seatTypes", slug: "seat-types", href: "/admin/master-data/seat-types", icon: Armchair },
  { key: "priceRules", slug: "price-rules", href: "/admin/master-data/price-rules", icon: Ticket },
  { key: "holidays", slug: "holidays", href: "/admin/master-data/holidays", icon: CalendarHeart },
  { key: "fnbCategories", slug: "fnb-categories", href: "/admin/master-data/fnb-categories", icon: Shapes },
  { key: "fnbItems", slug: "fnb-items", href: "/admin/master-data/fnb-items", icon: UtensilsCrossed },
  { key: "fnbCombos", slug: "fnb-combos", href: "/admin/master-data/fnb-combos", icon: Tag },
];

/** The section whose entry screens live under /admin/master-data/<slug>, if any. */
export function sectionFromSlug(slug: string): MasterDataSection | undefined {
  return MASTER_DATA_SECTIONS.find((section) => section.slug === slug);
}
