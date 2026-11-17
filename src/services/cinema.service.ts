import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { generateGrid } from "@/lib/seat-layout/generate";
import type { LayoutConfig, LayoutGeometry, LayoutSeat, SeatTypeInfo } from "@/lib/seat-layout/types";
import { Auditorium } from "@/models/auditorium";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { SeatType } from "@/models/seat-type";

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
    Brand.find({}).sort({ name: 1 }).lean(),
    Branch.find({}).sort({ name: 1 }).lean(),
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

export async function getCinema(branchId: string) {
  if (!isValidObjectId(branchId)) return null;
  await connectToDatabase();
  const branch = await Branch.findById(branchId).lean();
  if (!branch) return null;
  const [brand, rooms] = await Promise.all([
    Brand.findById(branch.brandId).lean(),
    Auditorium.find({ branchId, currentLayoutId: { $exists: true } }).sort({ name: 1 }).lean(),
  ]);
  const layouts = await AuditoriumLayout.aggregate<{ _id: { toString(): string }; seatCount: number }>([
    { $match: { _id: { $in: rooms.map((r) => r.currentLayoutId) } } },
    { $project: { seatCount: { $size: "$seats" } } },
  ]);
  const seatCount = new Map(layouts.map((l) => [l._id.toString(), l.seatCount]));
  return {
    brand: { id: brand?._id.toString() ?? "", name: brand?.name ?? "", logoUrl: brand?.logoUrl ?? null },
    branch: toBranch(branch),
    rooms: rooms.map((r) => ({ id: r._id.toString(), name: r.name, seatCount: seatCount.get(r.currentLayoutId?.toString() ?? "") ?? 0 })),
  };
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
    Branch.findById(branchId).lean(),
    SeatType.find({}).lean(),
  ]);
  if (!layout || !branch) return null;
  const brand = await Brand.findById(branch.brandId, "name").lean();
  const infos: SeatTypeInfo[] = types.map((t) => ({ id: t._id.toString(), name: t.name, capacity: t.capacity }));
  const { geometry } = generateGrid(layout.config as LayoutConfig, infos);
  return {
    auditorium: { id: room._id.toString(), name: room.name },
    branch: { id: branch._id.toString(), name: branch.name, brandName: brand?.name ?? "" },
    layoutId: layout._id.toString(),
    version: layout.version,
    seats: JSON.parse(JSON.stringify(layout.seats)) as LayoutSeat[],
    geometry,
    seatTypes: types.map((t) => ({ id: t._id.toString(), name: t.name, nameEn: t.nameEn ?? null, color: t.color ?? null })),
    summary: layout.summary,
  };
}
