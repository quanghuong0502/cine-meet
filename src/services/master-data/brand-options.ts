import { safeCache } from "@/lib/cache";
import { brandService } from "./brand.service";

/** Cache tag of the brand pick-list; `saveEntity`/`removeEntity` expire it after every master-data change. */
export const BRAND_OPTIONS_TAG = "master-data:brand-options";

export interface BrandOption {
  id: string;
  name: string;
  /** Off brands are hidden from users and from new pick-lists. */
  active: boolean;
  room3dPreset?: string;
}

/**
 * Brand names for the pick-lists and card subtitles of every brand-bound tab (branches, food, prices...). The same small list
 * was read again on every tab change; it is shared by all admins and changes rarely, so it is cached across requests.
 * Plain strings only (no ObjectId or Date), so it survives the cache's JSON round trip. Falls back to a fresh read after 5 minutes.
 */
export const getBrandOptions = safeCache(
  async (): Promise<BrandOption[]> =>
    (await brandService.list({})).map((brand) => ({
      id: brand._id.toString(),
      name: brand.name,
      active: brand.active !== false,
      room3dPreset: brand.room3dPreset ?? undefined,
    })),
  ["master-data-brand-options-v2"],
  { tags: [BRAND_OPTIONS_TAG], revalidate: 300 },
);
