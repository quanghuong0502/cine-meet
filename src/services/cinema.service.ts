import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { generateGrid } from "@/lib/seat-layout/generate";
import type { LayoutConfig, LayoutGeometry, LayoutSeat, SeatTypeInfo } from "@/lib/seat-layout/types";
import { Auditorium } from "@/models/auditorium";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { Format } from "@/models/format";
import { SeatMark } from "@/models/seat-mark";
import { Showtime } from "@/models/showtime";
import { SeatType } from "@/models/seat-type";
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
export async function listCinemaGroups(): Promise<CinemaGroup[]> {
  await connectToDatabase();
  const [brands, branches, rooms] = await Promise.all([
    Brand.find(ACTIVE).sort({ name: 1 }).lean(),
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
}

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
  const [groups, frequent, upcoming] = await Promise.all([
    listCinemaGroups(),
    listFrequentBranches(userId),
    Showtime.find({ startAt: { $gte: new Date() } }, "auditoriumId formatId").limit(2000).lean(),
  ]);
  const rooms = upcoming.length
    ? await Auditorium.find({ _id: { $in: [...new Set(upcoming.map((s) => s.auditoriumId.toString()))] } }, "branchId").lean()
    : [];
  const branchByRoom = new Map(rooms.map((r) => [r._id.toString(), r.branchId.toString()]));
  const formatsByBranch = new Map<string, Set<string>>();
  for (const s of upcoming) {
    const branchId = branchByRoom.get(s.auditoriumId.toString());
    if (!branchId) continue;
    formatsByBranch.set(branchId, (formatsByBranch.get(branchId) ?? new Set()).add(s.formatId.toString()));
  }
  const rank = new Map(frequent.map((b, index) => [b.id, index]));
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

/** A branch with its brand and its rooms. `userId` (from the session) adds the person's own seat-mark count to each room; without it the counts are 0. */
export async function getCinema(branchId: string, userId?: string) {
  if (!isValidObjectId(branchId)) return null;
  await connectToDatabase();
  const branch = await Branch.findOne({ _id: branchId, ...ACTIVE }).lean();
  if (!branch) return null;
  const [brand, rooms] = await Promise.all([
    Brand.findOne({ _id: branch.brandId, ...ACTIVE }).lean(),
    Auditorium.find({ branchId, currentLayoutId: { $exists: true } }).sort({ name: 1 }).lean(),
  ]);
  if (!brand) return null;
  const roomIds = rooms.map((r) => r._id);
  const [layouts, types, upcoming, marks] = await Promise.all([
    AuditoriumLayout.aggregate<{ _id: { toString(): string }; seatCount: number; types: string[] }>([
      { $match: { _id: { $in: rooms.map((r) => r.currentLayoutId) } } },
      { $project: { seatCount: { $size: "$seats" }, types: "$seats.type" } },
    ]),
    SeatType.find({}).lean(),
    Showtime.aggregate<{ _id: { room: { toString(): string }; format: { toString(): string } } }>([
      { $match: { auditoriumId: { $in: roomIds }, startAt: { $gte: new Date() } } },
      { $group: { _id: { room: "$auditoriumId", format: "$formatId" } } },
    ]),
    userId
      ? SeatMark.aggregate<{ _id: { toString(): string }; count: number }>([
          { $match: { userId: new Types.ObjectId(userId), auditoriumId: { $in: roomIds } } },
          { $group: { _id: "$auditoriumId", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);
  const formats = await Format.find({ _id: { $in: upcoming.map((u) => u._id.format) }, ...ACTIVE }, "name").lean();
  const formatName = new Map(formats.map((f) => [f._id.toString(), f.name]));
  const typeById = new Map(types.map((t) => [t._id.toString(), t]));
  const layoutById = new Map(layouts.map((l) => [l._id.toString(), l]));
  const markCount = new Map(marks.map((m) => [m._id.toString(), m.count]));

  return {
    brand: { id: brand._id.toString(), name: brand.name, logoUrl: brand.logoUrl ?? null },
    branch: toBranch(branch),
    rooms: rooms.map((r): CinemaRoom => {
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
            return type ? [{ name: type.name, nameEn: type.nameEn ?? null, count }] : [];
          })
          .sort((a, b) => b.count - a.count),
        formats: [
          ...new Set(upcoming.filter((u) => u._id.room.toString() === r._id.toString()).flatMap((u) => formatName.get(u._id.format.toString()) ?? [])),
        ].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
        markCount: markCount.get(r._id.toString()) ?? 0,
      };
    }),
  };
}

export interface RoomOption {
  id: string;
  label: string;
}

/** Every room, labelled "Branch · Room", for pick-lists such as logging a viewing by hand. */
export async function listRoomOptions(): Promise<RoomOption[]> {
  await connectToDatabase();
  const [rooms, branches] = await Promise.all([Auditorium.find({}, "name branchId").lean(), Branch.find({}, "name").lean()]);
  const branchById = new Map(branches.map((b) => [b._id.toString(), b.name]));
  return rooms
    .map((r) => ({ id: r._id.toString(), label: `${branchById.get(r.branchId.toString()) ?? "?"} · ${r.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export interface RoomView {
  auditorium: { id: string; name: string };
  branch: { id: string; name: string; brandName: string };
  layoutId: string;
  version: number;
  seats: LayoutSeat[];
  geometry: LayoutGeometry;
  seatTypes: { id: string; name: string; nameEn: string | null; color: string | null }[];
  summary: string;
}

/** The current layout of a room, ready for the read-only seat map. `branchId` must match, so a link cannot show a room under the wrong cinema. */
export async function getRoomView(branchId: string, auditoriumId: string): Promise<RoomView | null> {
  if (!isValidObjectId(branchId) || !isValidObjectId(auditoriumId)) return null;
  await connectToDatabase();
  const room = await Auditorium.findOne({ _id: auditoriumId, branchId }).lean();
  if (!room?.currentLayoutId) return null;
  const [layout, branch, types] = await Promise.all([
    AuditoriumLayout.findById(room.currentLayoutId).lean(),
    Branch.findOne({ _id: branchId, ...ACTIVE }).lean(),
    SeatType.find({}).lean(),
  ]);
  if (!layout || !branch) return null;
  const brand = await Brand.findOne({ _id: branch.brandId, ...ACTIVE }, "name").lean();
  if (!brand) return null;
  const infos: SeatTypeInfo[] = types.map((t) => ({ id: t._id.toString(), name: t.name, capacity: t.capacity }));
  const { geometry } = generateGrid(layout.config as LayoutConfig, infos);
  return {
    auditorium: { id: room._id.toString(), name: room.name },
    branch: { id: branch._id.toString(), name: branch.name, brandName: brand.name },
    layoutId: layout._id.toString(),
    version: layout.version,
    seats: JSON.parse(JSON.stringify(layout.seats)) as LayoutSeat[],
    geometry,
    seatTypes: types.map((t) => ({ id: t._id.toString(), name: t.name, nameEn: t.nameEn ?? null, color: t.color ?? null })),
    summary: layout.summary,
  };
}
