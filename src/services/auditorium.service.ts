import mongoose, { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { layoutConfigSchema } from "@/lib/seat-layout/config";
import { NO_SEAT, type LayoutConfig, type SeatTypeInfo } from "@/lib/seat-layout/types";
import { Auditorium } from "@/models/auditorium";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { Branch } from "@/models/branch";
import { Showtime } from "@/models/showtime";
import { SeatMark } from "@/models/seat-mark";
import { SeatType } from "@/models/seat-type";
import { recordAudit } from "@/services/audit.service";
import { getCinemaDimensions } from "@/services/cinema-dimensions.service";
import { buildLayout } from "@/services/seat-layout-build";

export type AuditoriumError =
  | "not_found"
  | "duplicate"
  | "invalid_config"
  | "branch_not_found"
  | "seat_type_not_found"
  | "in_use";
export type AuditoriumResult<T> = { ok: true; data: T } | { ok: false; error: AuditoriumError };

export interface AuditoriumSummary {
  id: string;
  branchId: string;
  name: string;
  currentLayoutId: string | null;
  version: number;
  seatCount: number;
}

export interface LayoutVersionInfo {
  id: string;
  version: number;
  seatCount: number;
  createdAt: Date;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

async function loadSeatTypes(): Promise<SeatTypeInfo[]> {
  const docs = await SeatType.find({}, "name capacity").lean();
  return docs.map((d) => ({ id: d._id.toString(), name: d.name, capacity: d.capacity }));
}

/** Parses the config and checks every seat type it mentions exists. */
async function prepareConfig(
  raw: unknown,
): Promise<AuditoriumResult<{ config: LayoutConfig; seatTypes: SeatTypeInfo[] }>> {
  const parsed = layoutConfigSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_config" };
  const config = parsed.data as LayoutConfig;
  const seatTypes = await loadSeatTypes();
  const known = new Set(seatTypes.map((t) => t.id));
  const used = [config.defaultSeatType, ...config.overrides.map((o) => o.type)].filter(
    (t): t is string => !!t && t !== NO_SEAT,
  );
  if (used.some((id) => !known.has(id))) return { ok: false, error: "seat_type_not_found" };
  return { ok: true, data: { config, seatTypes } };
}

/** Rooms with the size of their current layout, newest layout counts only. */
export async function listAuditoriums(options: { branchId?: string } = {}): Promise<AuditoriumSummary[]> {
  await connectToDatabase();
  const filter = options.branchId && isValidObjectId(options.branchId) ? { branchId: options.branchId } : {};
  const rooms = await Auditorium.find(filter, "branchId name currentLayoutId").sort({ name: 1 }).lean();
  const layoutIds = rooms.map((r) => r.currentLayoutId).filter(Boolean);
  const layouts = layoutIds.length
    ? await AuditoriumLayout.aggregate<{ _id: mongoose.Types.ObjectId; version: number; seatCount: number }>([
        { $match: { _id: { $in: layoutIds } } },
        { $project: { version: 1, seatCount: { $size: "$seats" } } },
      ])
    : [];
  const byId = new Map(layouts.map((l) => [l._id.toString(), l]));
  return rooms.map((r) => {
    const layout = r.currentLayoutId ? byId.get(r.currentLayoutId.toString()) : undefined;
    return {
      id: r._id.toString(),
      branchId: r.branchId.toString(),
      name: r.name,
      currentLayoutId: r.currentLayoutId?.toString() ?? null,
      version: layout?.version ?? 0,
      seatCount: layout?.seatCount ?? 0,
    };
  });
}

export async function getAuditorium(id: string) {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  return Auditorium.findById(id, "branchId name currentLayoutId").lean();
}

/** Reads only `config` from a layout document by id (skips transferring 150-400 seat objects for the editor). */
export async function getLayoutConfigById(layoutId: string): Promise<LayoutConfig | null> {
  if (!isValidObjectId(layoutId)) return null;
  await connectToDatabase();
  const doc = await AuditoriumLayout.findById(layoutId, "config").lean();
  return (doc?.config as LayoutConfig | undefined) ?? null;
}

/** One layout version, or the current one when `layoutId` is omitted. Must belong to the room. */
export async function getLayout(auditoriumId: string, layoutId?: string) {
  if (!isValidObjectId(auditoriumId)) return null;
  if (layoutId !== undefined && !isValidObjectId(layoutId)) return null;
  await connectToDatabase();
  const room = await Auditorium.findById(auditoriumId).lean();
  if (!room) return null;
  const id = layoutId ?? room.currentLayoutId?.toString();
  if (!id) return null;
  return AuditoriumLayout.findOne({ _id: id, auditoriumId }).lean();
}

/** Newest first. */
export async function listLayoutVersions(auditoriumId: string): Promise<LayoutVersionInfo[]> {
  if (!isValidObjectId(auditoriumId)) return [];
  await connectToDatabase();
  const rows = await AuditoriumLayout.aggregate<{ _id: mongoose.Types.ObjectId; version: number; seatCount: number; createdAt: Date }>([
    { $match: { auditoriumId: new mongoose.Types.ObjectId(auditoriumId) } },
    { $sort: { version: -1 } },
    { $project: { version: 1, createdAt: 1, seatCount: { $size: "$seats" } } },
  ]);
  return rows.map((r) => ({ id: r._id.toString(), version: r.version, seatCount: r.seatCount, createdAt: r.createdAt }));
}

export async function createAuditorium(
  input: { branchId: string; name: string; config: unknown },
  actorId: string,
): Promise<AuditoriumResult<{ id: string; layoutId: string }>> {
  await connectToDatabase();
  if (!isValidObjectId(input.branchId) || !(await Branch.exists({ _id: input.branchId }))) {
    return { ok: false, error: "branch_not_found" };
  }
  const prepared = await prepareConfig(input.config);
  if (!prepared.ok) return prepared;
  const { config, seatTypes } = prepared.data;
  const defaults = await getCinemaDimensions();
  const built = buildLayout(config, seatTypes, defaults);

  const session = await mongoose.startSession();
  try {
    const out: { value?: { id: string; layoutId: string } } = {};
    await session.withTransaction(async () => {
      const [room] = await Auditorium.create([{ branchId: input.branchId, name: input.name }], { session });
      const [layout] = await AuditoriumLayout.create(
        [{ auditoriumId: room._id, version: 1, config, seats: built.seats, summary: built.summary, createdBy: actorId }],
        { session },
      );
      room.currentLayoutId = layout._id;
      await room.save({ session });
      out.value = { id: room._id.toString(), layoutId: layout._id.toString() };
    });
    if (!out.value) throw new Error("transaction did not run");
    const created = out.value;
    await recordAudit({
      actorId,
      action: "create",
      entity: "auditorium",
      entityId: created.id,
      after: { name: input.name, branchId: input.branchId, version: 1 },
    });
    return { ok: true, data: created };
  } catch (error) {
    if (isDuplicateKeyError(error)) return { ok: false, error: "duplicate" };
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Saves a room. A changed layout config creates a NEW version (the old one is kept as is, design 2.2);
 * an unchanged config only renames the room.
 */
export async function updateAuditorium(
  id: string,
  input: { name: string; config: unknown },
  actorId: string,
): Promise<AuditoriumResult<{ layoutId: string; version: number; createdVersion: boolean }>> {
  await connectToDatabase();
  const room = await getAuditorium(id);
  if (!room) return { ok: false, error: "not_found" };
  const prepared = await prepareConfig(input.config);
  if (!prepared.ok) return prepared;
  const { config, seatTypes } = prepared.data;

  const [current, defaults] = await Promise.all([
    room.currentLayoutId ? AuditoriumLayout.findById(room.currentLayoutId, "config version").lean() : Promise.resolve(null),
    getCinemaDimensions(),
  ]);
  const unchanged = current && JSON.stringify(normalize(current.config)) === JSON.stringify(normalize(config));
  // Compute layout outside the transaction so MongoDB holds locks only for the writes.
  const built = current && unchanged ? null : buildLayout(config, seatTypes, defaults);

  const session = await mongoose.startSession();
  try {
    const out: { value?: { layoutId: string; version: number; createdVersion: boolean } } = {};
    await session.withTransaction(async () => {
      if (room.name !== input.name) await Auditorium.updateOne({ _id: id }, { name: input.name }, { session });
      if (current && unchanged) {
        out.value = { layoutId: current._id.toString(), version: current.version, createdVersion: false };
        return;
      }
      const latest = await AuditoriumLayout.findOne({ auditoriumId: id }, "version").sort({ version: -1 }).session(session).lean();
      const version = (latest?.version ?? 0) + 1;
      const [layout] = await AuditoriumLayout.create(
        [{ auditoriumId: id, version, config, seats: built!.seats, summary: built!.summary, createdBy: actorId }],
        { session },
      );
      await Auditorium.updateOne({ _id: id }, { currentLayoutId: layout._id }, { session });
      out.value = { layoutId: layout._id.toString(), version, createdVersion: true };
    });
    if (!out.value) throw new Error("transaction did not run");
    const saved = out.value;
    await recordAudit({
      actorId,
      action: "update",
      entity: "auditorium",
      entityId: id,
      before: { name: room.name, version: current?.version },
      after: { name: input.name, version: saved.version },
    });
    return { ok: true, data: saved };
  } catch (error) {
    if (isDuplicateKeyError(error)) return { ok: false, error: "duplicate" };
    throw error;
  } finally {
    await session.endSession();
  }
}

/** Deletes a room and all its layout versions. A room that still has showtimes cannot be deleted; its seat marks go with it. */
export async function removeAuditorium(id: string, actorId: string): Promise<AuditoriumResult<null>> {
  await connectToDatabase();
  const room = await getAuditorium(id);
  if (!room) return { ok: false, error: "not_found" };
  if (await Showtime.exists({ auditoriumId: id })) return { ok: false, error: "in_use" };
  await Promise.all([
    SeatMark.deleteMany({ auditoriumId: id }),
    AuditoriumLayout.deleteMany({ auditoriumId: id }),
  ]);
  await Auditorium.deleteOne({ _id: id });
  await recordAudit({
    actorId,
    action: "delete",
    entity: "auditorium",
    entityId: id,
    before: { name: room.name, branchId: room.branchId },
  });
  return { ok: true, data: null };
}

/** Plain JSON with the key order of the schema, so a stored config and a new one compare equal. */
function normalize(config: unknown): unknown {
  const parsed = layoutConfigSchema.safeParse(JSON.parse(JSON.stringify(config)));
  return parsed.success ? parsed.data : config;
}
