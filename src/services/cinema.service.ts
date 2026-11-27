import { isValidObjectId, Types } from "mongoose";
import { cache } from "react";
import { CATALOG_CINEMAS_TAG, safeCache } from "@/lib/cache";
import { connectToDatabase } from "@/lib/db";
import { DEFAULT_STEPS_PER_ROW } from "@/lib/seat-layout/config.constants";
import { generateGrid } from "@/lib/seat-layout/generate";
import { resolveBrandRoom3DAppearance, type Room3DAppearance } from "@/lib/seat-layout/room-3d-appearance.defaults";
import type { Room3DConfig } from "@/lib/seat-layout/scene";
import type { LayoutConfig, LayoutGeometry, LayoutSeat, SeatStyle, SeatTypeInfo } from "@/lib/seat-layout/types";
import { Auditorium } from "@/models/auditorium";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { SeatMark } from "@/models/seat-mark";
import { Showtime } from "@/models/showtime";
import { getCinemaDimensions } from "@/services/cinema-dimensions.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { getCachedFormats, getCachedSeatTypes } from "@/services/master-data/catalog-cache";
import { getRoom3DAppearance } from "@/services/room-3d-appearance.service";
import { listViewingSessions, rankFrequentBranches } from "@/services/viewing-history.service";

/** Plain objects only (strings, numbers): they go straight to client components. */
export interface CinemaBranch {
  id: string;
  name: string;
  address: string | null;
  imageUrl: string | null;
  openingHours: string | null;
  floor: string | null;
  mapsUrl: string | null;
  parkingFee: number | null;
  parkingLocation: string | null;
  parkingEntrance: string | null;
}

export interface CinemaGroup {
  brand: { id: string; name: string; logoUrl: string | null };
  branches: (CinemaBranch & { roomCount: number })[];
}

/** A record switched off by an admin is hidden from users; one with no value (made before the switch existed) counts as on. */
export const ACTIVE = { active: { $ne: false } } as const;

interface BranchLean {
  _id: { toString(): string };
  name: string;
  address?: string | null;
  imageUrl?: string | null;
  openingHours?: string | null;
  floor?: string | null;
  mapsUrl?: string | null;
  parkingFee?: number | null;
  parkingLocation?: string | null;
  parkingEntrance?: string | null;
}

function toBranch(doc: BranchLean): CinemaBranch {
  return {
    id: doc._id.toString(),
    name: doc.name,
    address: doc.address ?? null,
    imageUrl: doc.imageUrl ?? null,
    openingHours: doc.openingHours ?? null,
    floor: doc.floor ?? null,
    mapsUrl: doc.mapsUrl ?? null,
    parkingFee: doc.parkingFee ?? null,
    parkingLocation: doc.parkingLocation ?? null,
    parkingEntrance: doc.parkingEntrance ?? null,
  };
}

/** Brands with their branches (only branches that have at least one room with a seat map), by name. */
export const listCinemaGroups = safeCache(
  async (): Promise<CinemaGroup[]> => {
    await connectToDatabase();
    const [brands, branches, rooms] = await Promise.all([
      Brand.find(ACTIVE, "name logoUrl").sort({ name: 1 }).lean(),
      Branch.find(ACTIVE).sort({ name: 1 }).lean(),
      Auditorium.find({ currentLayoutId: { $exists: true } }, "branchId").lean(),
    ]);
    const roomCount = new Map<string, number>();
    for (const room of rooms) roomCount.set(room.branchId.toString(), (roomCount.get(room.branchId.toString()) ?? 0) + 1);
    return brands
      .map((brand) => ({
        brand: { id: brand._id.toString(), name: brand.name, logoUrl: brand.logoUrl ?? null },
        branches: branches
          .filter((b) => b.brandId.toString() === brand._id.toString() && roomCount.has(b._id.toString()))
          .map((b) => ({ ...toBranch(b), roomCount: roomCount.get(b._id.toString()) ?? 0 })),
      }))
      .filter((group) => group.branches.length > 0);
  },
  ["catalog-cinema-groups"],
  { tags: [CATALOG_CINEMAS_TAG], revalidate: 300 },
);

/**
 * The signed-in person's most-visited branches (design 3.2 "Thường tới"), in order, with no community data involved. Empty
 * when they have not completed a single viewing yet: the caller then shows no such group at all.
 */
export async function listFrequentBranches(userId: string, limit = 5): Promise<CinemaBranch[]> {
  await connectToDatabase();
  const sessions = await listViewingSessions(userId);
  const ranked = rankFrequentBranches(sessions).slice(0, limit);
  if (ranked.length === 0) return [];
  const branches = await Branch.find({ _id: { $in: ranked.map((r) => r.branchId) }, ...ACTIVE }).lean();
  const byId = new Map(branches.map((b) => [b._id.toString(), b]));
  return ranked.flatMap((r) => {
    const branch = byId.get(r.branchId);
    return branch ? [toBranch(branch)] : [];
  });
}

/** One branch of the flat cinema list, with what the filters need (brand, formats of its upcoming showtimes, whether the person often goes). */
export interface CinemaListItem extends CinemaBranch {
  roomCount: number;
  brand: string;
  brandName: string;
  format: string[];
  /** ["1"] when the person often visits this branch, else empty. */
  frequent: string[];
}

/**
 * Every branch with a seat map in one list (no brand groups): the person's most-visited branches first, then by name. Filtering by
 * brand, format and "often visited" happens on this list (`lib/cinema/filters`).
 */
export async function listCinemaList(userId: string): Promise<CinemaListItem[]> {
  await connectToDatabase();
  const [groups, sessions, upcomingPairs] = await Promise.all([
    listCinemaGroups(),
    listViewingSessions(userId),
    Showtime.aggregate<{ _id: { room: Types.ObjectId; format: Types.ObjectId } }>([
      { $match: { startAt: { $gte: new Date() } } },
      { $group: { _id: { room: "$auditoriumId", format: "$formatId" } } },
    ]),
  ]);
  const frequent = rankFrequentBranches(sessions).slice(0, 5);
  const uniqueRoomIds = [...new Set(upcomingPairs.map((p) => p._id.room.toString()))];
  const rooms = uniqueRoomIds.length
    ? await Auditorium.find({ _id: { $in: uniqueRoomIds } }, "branchId").lean()
    : [];
  const branchByRoom = new Map(rooms.map((r) => [r._id.toString(), r.branchId.toString()]));
  const formatsByBranch = new Map<string, Set<string>>();
  for (const p of upcomingPairs) {
    const branchId = branchByRoom.get(p._id.room.toString());
    if (!branchId) continue;
    const set = formatsByBranch.get(branchId) ?? new Set<string>();
    set.add(p._id.format.toString());
    formatsByBranch.set(branchId, set);
  }
  const rank = new Map(frequent.map((b, index) => [b.branchId, index]));
  return groups
    .flatMap((group) =>
      group.branches.map((branch) => ({
        ...branch,
        brand: group.brand.id,
        brandName: group.brand.name,
        format: [...(formatsByBranch.get(branch.id) ?? [])],
        frequent: rank.has(branch.id) ? ["1"] : [],
      })),
    )
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.name.localeCompare(b.name, "vi"));
}

export interface CinemaRoom {
  id: string;
  name: string;
  seatCount: number;
  /** Seat types used in the room with how many seats of each, most seats first (the first is the room's ordinary seat). */
  seatTypes: { name: string; nameEn: string | null; count: number }[];
  /** Formats the room has upcoming showtimes in, by name. */
  formats: string[];
  /** How many seats of this room the signed-in person has marked. */
  markCount: number;
}

/** User-agnostic cinema details deduplicated per render via React `cache()` (shared by `generateMetadata` and `CinemaPage`). */
const getCinemaBase = cache(async (branchId: string) => {
  if (!isValidObjectId(branchId)) return null;
  await connectToDatabase();
  const branch = await Branch.findOne({ _id: branchId, ...ACTIVE }).lean();
  if (!branch) return null;
  const [brand, rooms] = await Promise.all([
    Brand.findOne({ _id: branch.brandId, ...ACTIVE }, "name logoUrl").lean(),
    Auditorium.find({ branchId, currentLayoutId: { $exists: true } }, "name currentLayoutId").sort({ name: 1 }).lean(),
  ]);
  if (!brand) return null;
  const roomIds = rooms.map((r) => r._id);
  const layoutIds = rooms.flatMap((r) => (r.currentLayoutId ? [r.currentLayoutId] : []));
  const [layouts, types, formats, upcoming] = await Promise.all([
    layoutIds.length
      ? AuditoriumLayout.aggregate<{ _id: { toString(): string }; seatCount: number; types: string[] }>([
          { $match: { _id: { $in: layoutIds } } },
          { $project: { seatCount: { $size: "$seats" }, types: "$seats.type" } },
        ])
      : Promise.resolve([]),
    getCachedSeatTypes(),
    getCachedFormats(),
    roomIds.length
      ? Showtime.aggregate<{ _id: { room: { toString(): string }; format: { toString(): string } } }>([
          { $match: { auditoriumId: { $in: roomIds }, startAt: { $gte: new Date() } } },
          { $group: { _id: { room: "$auditoriumId", format: "$formatId" } } },
        ])
      : Promise.resolve([]),
  ]);
  const formatName = new Map(formats.filter((f) => f.active).map((f) => [f.id, f.name]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const layoutById = new Map(layouts.map((l) => [l._id.toString(), l]));

  return {
    brand: { id: brand._id.toString(), name: brand.name, logoUrl: brand.logoUrl ?? null },
    branch: toBranch(branch),
    roomIds,
    rooms: rooms.map((r): Omit<CinemaRoom, "markCount"> => {
      const layout = layoutById.get(r.currentLayoutId?.toString() ?? "");
      const counts = new Map<string, number>();
      for (const type of layout?.types ?? []) counts.set(type, (counts.get(type) ?? 0) + 1);
      return {
        id: r._id.toString(),
        name: r.name,
        seatCount: layout?.seatCount ?? 0,
        seatTypes: [...counts.entries()]
          .flatMap(([id, count]) => {
            const type = typeById.get(id);
            return type ? [{ name: type.name, nameEn: type.nameEn, count }] : [];
          })
          .sort((a, b) => b.count - a.count),
        formats: [
          ...new Set(upcoming.filter((u) => u._id.room.toString() === r._id.toString()).flatMap((u) => formatName.get(u._id.format.toString()) ?? [])),
        ].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
      };
    }),
  };
});

/** A branch with its brand and its rooms. `userId` (from the session) adds the person's own seat-mark count to each room; without it the counts are 0. */
export async function getCinema(branchId: string, userId?: string) {
  const base = await getCinemaBase(branchId);
  if (!base) return null;
  const marks =
    userId && base.roomIds.length > 0
      ? await SeatMark.aggregate<{ _id: { toString(): string }; count: number }>([
          { $match: { userId: new Types.ObjectId(userId), auditoriumId: { $in: base.roomIds } } },
          { $group: { _id: "$auditoriumId", count: { $sum: 1 } } },
        ])
      : [];
  const markCount = new Map(marks.map((m) => [m._id.toString(), m.count]));
  return {
    brand: base.brand,
    branch: base.branch,
    rooms: base.rooms.map((r): CinemaRoom => ({ ...r, markCount: markCount.get(r.id) ?? 0 })),
  };
}

export interface RoomOption {
  id: string;
  label: string;
}

/** Every active room, labelled "Brand · Branch · Room", for pick-lists such as logging a viewing by hand. */
export const listRoomOptions = safeCache(
  async (): Promise<RoomOption[]> => {
    await connectToDatabase();
    const [rooms, branches, brands] = await Promise.all([
      Auditorium.find({}, "name branchId").lean(),
      Branch.find({ active: { $ne: false } }, "name brandId").lean(),
      getBrandOptions(),
    ]);
    const brandName = new Map(brands.map((b) => [b.id, b.name]));
    const branchLabel = new Map(
      branches.map((b) => [b._id.toString(), [brandName.get(b.brandId.toString()), b.name].filter(Boolean).join(" · ")]),
    );
    return rooms
      .filter((r) => branchLabel.has(r.branchId.toString()))
      .map((r) => ({ id: r._id.toString(), label: `${branchLabel.get(r.branchId.toString())} · ${r.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  },
  ["catalog-room-options"],
  { tags: [CATALOG_CINEMAS_TAG], revalidate: 300 },
);

export interface RoomView {
  auditorium: { id: string; name: string };
  branch: { id: string; name: string; brandName: string };
  brandName: string;
  layoutId: string;
  version: number;
  seats: LayoutSeat[];
  geometry: LayoutGeometry;
  room3d: Room3DConfig;
  room3dAppearance: Room3DAppearance;
  seatTypes: { id: string; name: string; nameEn: string | null; color: string | null; color3d: string | null; style: SeatStyle }[];
}

/** Slim client prop for `<RoomSeatView>` — drops server-only `branch` and `version`. */
export type RoomSeatClientView = Omit<RoomView, "branch" | "version">;

/** The current layout of a room, deduplicated per render via React `cache()` so `generateMetadata` and `RoomPage` share one load. */
export const getRoomView = cache(async (branchId: string, auditoriumId: string): Promise<RoomView | null> => {
  if (!isValidObjectId(branchId) || !isValidObjectId(auditoriumId)) return null;
  await connectToDatabase();
  const [room, branch, types, dimensionDefaults, systemAppearance] = await Promise.all([
    Auditorium.findOne({ _id: auditoriumId, branchId }, "name currentLayoutId").lean(),
    Branch.findOne({ _id: branchId, ...ACTIVE }, "name brandId").lean(),
    getCachedSeatTypes(),
    getCinemaDimensions(),
    getRoom3DAppearance(),
  ]);
  if (!room?.currentLayoutId || !branch) return null;
  const [layout, brand] = await Promise.all([
    AuditoriumLayout.findById(room.currentLayoutId, "version config seats").lean(),
    Brand.findOne({ _id: branch.brandId, ...ACTIVE }, "name room3dPreset").lean(),
  ]);
  if (!layout || !brand) return null;
  const room3dAppearance = resolveBrandRoom3DAppearance(systemAppearance, brand.room3dPreset);
  const infos: SeatTypeInfo[] = types.map((t) => ({
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    style: t.style,
  }));
  const config = layout.config as LayoutConfig;
  const { geometry } = generateGrid(config, infos);
  return {
    auditorium: { id: room._id.toString(), name: room.name },
    branch: { id: branch._id.toString(), name: branch.name, brandName: brand.name },
    brandName: brand.name,
    layoutId: layout._id.toString(),
    version: layout.version,
    seats: JSON.parse(JSON.stringify(layout.seats)) as LayoutSeat[],
    geometry,
    room3d: {
      stadiumFromRow: config.stadiumFromRow,
      stepsPerRow: config.stepsPerRow ?? DEFAULT_STEPS_PER_ROW,
      screenDistance: config.screen.distance,
      screenShape: config.screen.shape,
      screenMount: config.screen.mount,
      screenTilt: config.screen.tilt,
      screenCurved: Boolean(config.screen.curved),
      seatRecline: config.seatRecline,
      rowCurve: config.rowCurve ?? "straight",
      seatStagger: config.seatStagger ?? "aligned",
      rowPitch: config.rowPitch ?? "standard",
      dimensions: config.dimensions,
      defaults: dimensionDefaults,
    },
    room3dAppearance,
    seatTypes: types.map((t) => ({
      id: t.id,
      name: t.name,
      nameEn: t.nameEn,
      color: t.color,
      color3d: t.color3d,
      style: t.style,
    })),
  };
});
