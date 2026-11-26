import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { objectIdField, requiredText } from "@/lib/validation/fields";
import { Auditorium } from "@/models/auditorium";
import { Branch } from "@/models/branch";
import { RoomReport, type RoomReportStatus } from "@/models/room-report";
import { User } from "@/models/user";

export const roomReportInputSchema = z.object({ auditoriumId: objectIdField, note: requiredText(500) });
export type RoomReportInput = z.infer<typeof roomReportInputSchema>;

/** A user flags that a room's info or layout looks wrong (design 2.7). Admin reads these later; nothing changes automatically. */
export async function reportRoom(userId: string, input: RoomReportInput): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  if (!isValidObjectId(input.auditoriumId)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const room = await Auditorium.exists({ _id: input.auditoriumId });
  if (!room) return { ok: false, error: "not_found" };
  await RoomReport.create({ userId, auditoriumId: input.auditoriumId, note: input.note });
  return { ok: true };
}

export interface RoomReportRow {
  id: string;
  auditoriumId: string;
  roomName: string;
  branchName: string;
  reporterName: string;
  note: string;
  status: RoomReportStatus;
  createdAt: string;
}

/** Fast indexed count of open reports for the Admin Settings summary card. */
export async function countOpenRoomReports(): Promise<number> {
  await connectToDatabase();
  return RoomReport.countDocuments({ status: "open" });
}

/** Every report, newest first, for the admin screen. */
export async function listRoomReports(): Promise<RoomReportRow[]> {
  await connectToDatabase();
  const reports = await RoomReport.find({}).sort({ createdAt: -1 }).limit(200).lean();
  if (reports.length === 0) return [];
  const roomIds = [...new Set(reports.map((r) => r.auditoriumId.toString()))];
  const userIds = [...new Set(reports.map((r) => r.userId.toString()))];
  const [rooms, users] = await Promise.all([
    Auditorium.find({ _id: { $in: roomIds } }, "name branchId").lean(),
    User.find({ _id: { $in: userIds } }, "name").lean(),
  ]);
  const branchIds = [...new Set(rooms.map((r) => r.branchId.toString()))];
  const branches = branchIds.length ? await Branch.find({ _id: { $in: branchIds } }, "name").lean() : [];
  const branchById = new Map(branches.map((b) => [b._id.toString(), b.name]));
  const roomById = new Map(rooms.map((r) => [r._id.toString(), r]));
  const userById = new Map(users.map((u) => [u._id.toString(), u.name]));
  return reports.map((r) => {
    const room = roomById.get(r.auditoriumId.toString());
    return {
      id: r._id.toString(),
      auditoriumId: r.auditoriumId.toString(),
      roomName: room?.name ?? "?",
      branchName: room ? (branchById.get(room.branchId.toString()) ?? "?") : "?",
      reporterName: userById.get(r.userId.toString()) ?? "?",
      note: r.note,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function resolveRoomReport(id: string): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const result = await RoomReport.updateOne({ _id: id }, { $set: { status: "resolved" } });
  return result.matchedCount === 0 ? { ok: false, error: "not_found" } : { ok: true };
}
