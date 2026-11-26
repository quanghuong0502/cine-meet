import { MASTER_DATA_CATALOG_TAG, safeCache } from "@/lib/cache";
import { connectToDatabase } from "@/lib/db";
import type { SeatStyle } from "@/lib/seat-layout/types";
import { AgeRating } from "@/models/age-rating";
import { Branch } from "@/models/branch";
import { Format } from "@/models/format";
import { Genre } from "@/models/genre";
import { SeatType } from "@/models/seat-type";

export interface CachedBranchOption {
  id: string;
  brandId: string;
  name: string;
  active: boolean;
}

export interface CachedGenreOption {
  id: string;
  name: string;
  nameEn: string | null;
  active: boolean;
}

export interface CachedFormatOption {
  id: string;
  name: string;
  active: boolean;
}

export interface CachedAgeRatingOption {
  id: string;
  code: string;
  minAge: number;
  color: string | null;
}

export interface CachedSeatTypeOption {
  id: string;
  name: string;
  nameEn: string | null;
  color: string | null;
  capacity: number;
  style: SeatStyle;
}

export const getCachedBranches = safeCache(
  async (): Promise<CachedBranchOption[]> => {
    await connectToDatabase();
    const rows = await Branch.find({}, "brandId name active").sort({ name: 1 }).lean();
    return rows.map((b) => ({
      id: b._id.toString(),
      brandId: b.brandId.toString(),
      name: b.name,
      active: b.active !== false,
    }));
  },
  ["master-data-branches"],
  { tags: [MASTER_DATA_CATALOG_TAG], revalidate: 300 },
);

export const getCachedGenres = safeCache(
  async (): Promise<CachedGenreOption[]> => {
    await connectToDatabase();
    const rows = await Genre.find({}, "name nameEn active").sort({ name: 1 }).lean();
    return rows.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      nameEn: g.nameEn ?? null,
      active: g.active !== false,
    }));
  },
  ["master-data-genres"],
  { tags: [MASTER_DATA_CATALOG_TAG], revalidate: 300 },
);

export const getCachedFormats = safeCache(
  async (): Promise<CachedFormatOption[]> => {
    await connectToDatabase();
    const rows = await Format.find({}, "name active").sort({ name: 1 }).lean();
    return rows.map((f) => ({
      id: f._id.toString(),
      name: f.name,
      active: f.active !== false,
    }));
  },
  ["master-data-formats"],
  { tags: [MASTER_DATA_CATALOG_TAG], revalidate: 300 },
);

export const getCachedAgeRatings = safeCache(
  async (): Promise<CachedAgeRatingOption[]> => {
    await connectToDatabase();
    const rows = await AgeRating.find({}, "code minAge color").sort({ minAge: 1, code: 1 }).lean();
    return rows.map((r) => ({
      id: r._id.toString(),
      code: r.code,
      minAge: r.minAge,
      color: r.color ?? null,
    }));
  },
  ["master-data-age-ratings"],
  { tags: [MASTER_DATA_CATALOG_TAG], revalidate: 300 },
);

export const getCachedSeatTypes = safeCache(
  async (): Promise<CachedSeatTypeOption[]> => {
    await connectToDatabase();
    const rows = await SeatType.find({}, "name nameEn color capacity style").sort({ name: 1 }).lean();
    return rows.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      nameEn: t.nameEn ?? null,
      color: t.color ?? null,
      capacity: t.capacity,
      style: (t.style as SeatStyle | undefined) ?? "standard",
    }));
  },
  ["master-data-seat-types"],
  { tags: [MASTER_DATA_CATALOG_TAG], revalidate: 300 },
);
