import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { matchMarks, type SeatPlace } from "@/lib/seat-layout/marks";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { SEAT_MARK_KINDS, SEAT_MARK_TAGS, SeatMark } from "@/models/seat-mark";

export const seatMarkInputSchema = z.object({
  auditoriumId: z.string().regex(/^[0-9a-fA-F]{24}$/, { error: "invalid" }),
  layoutId: z.string().regex(/^[0-9a-fA-F]{24}$/, { error: "invalid" }),
  seatCode: z.string().trim().min(1).max(8),
  kind: z.enum(SEAT_MARK_KINDS),
  tags: z.array(z.enum(SEAT_MARK_TAGS)).max(SEAT_MARK_TAGS.length).default([]),
  note: z.string().trim().max(200).optional(),
});
export type SeatMarkInput = z.infer<typeof seatMarkInputSchema>;

export interface SeatMarkView {
  seatCode: string;
  kind: (typeof SEAT_MARK_KINDS)[number];
  tags: (typeof SEAT_MARK_TAGS)[number][];
  note: string;
}

export type SeatMarkResult = { ok: true } | { ok: false; error: "not_found" | "invalid" };

/**
 * Saves (or replaces) this person's mark on a seat. `userId` is the signed-in user, passed by the caller from the session.
 * The seat must exist in the layout version the person was looking at.
 */
export async function saveSeatMark(userId: string, input: SeatMarkInput): Promise<SeatMarkResult> {
  await connectToDatabase();
  // Check seat membership directly in MongoDB without transferring the entire `seats.code` array over the wire.
  const [hasSeat, hasLayout] = await Promise.all([
    AuditoriumLayout.exists({ _id: input.layoutId, auditoriumId: input.auditoriumId, "seats.code": input.seatCode }),
    AuditoriumLayout.exists({ _id: input.layoutId, auditoriumId: input.auditoriumId }),
  ]);
  if (!hasLayout) return { ok: false, error: "not_found" };
  if (!hasSeat) return { ok: false, error: "invalid" };
  await SeatMark.updateOne(
    { userId, auditoriumId: input.auditoriumId, seatCode: input.seatCode },
    {
      $set: { layoutId: input.layoutId, kind: input.kind, tags: [...new Set(input.tags)], ...(input.note ? { note: input.note } : {}) },
      ...(input.note ? {} : { $unset: { note: 1 } }),
    },
    { upsert: true },
  );
  return { ok: true };
}

export async function removeSeatMark(userId: string, auditoriumId: string, seatCode: string): Promise<SeatMarkResult> {
  if (!isValidObjectId(auditoriumId)) return { ok: false, error: "invalid" };
  await connectToDatabase();
  const removed = await SeatMark.deleteOne({ userId, auditoriumId, seatCode });
  return removed.deletedCount ? { ok: true } : { ok: false, error: "not_found" };
}

/** This person's marks in a room, split for the layout version being viewed: the ones that still apply, and the old ones. */
export async function getSeatMarks(
  userId: string,
  auditoriumId: string,
  viewedLayoutId: string,
): Promise<{ active: SeatMarkView[]; old: SeatMarkView[] }> {
  if (!isValidObjectId(auditoriumId) || !isValidObjectId(viewedLayoutId)) return { active: [], old: [] };
  await connectToDatabase();
  const marks = await SeatMark.find({ userId, auditoriumId }).lean();
  if (marks.length === 0) return { active: [], old: [] };

  const layoutIds = [...new Set([viewedLayoutId, ...marks.map((m) => m.layoutId.toString())])];
  const layouts = await AuditoriumLayout.find({ _id: { $in: layoutIds }, auditoriumId }, "seats.code seats.rowIndex seats.colIndex seats.span").lean();
  const places = new Map<string, SeatPlace[]>(
    layouts.map((l) => [l._id.toString(), l.seats.map((s) => ({ code: s.code, rowIndex: s.rowIndex, colIndex: s.colIndex, span: s.span }))]),
  );

  const rows = marks.map((m) => ({
    seatCode: m.seatCode,
    layoutId: m.layoutId.toString(),
    kind: m.kind,
    tags: m.tags as SeatMarkView["tags"],
    note: m.note ?? "",
  }));
  const { active, old } = matchMarks(rows, viewedLayoutId, places.get(viewedLayoutId) ?? [], places);
  const view = ({ seatCode, kind, tags, note }: (typeof rows)[number]): SeatMarkView => ({ seatCode, kind, tags, note });
  const byCode = (a: SeatMarkView, b: SeatMarkView) => a.seatCode.localeCompare(b.seatCode, "en", { numeric: true });
  return { active: active.map(view).sort(byCode), old: old.map(view).sort(byCode) };
}
