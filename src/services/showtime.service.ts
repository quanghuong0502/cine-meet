import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import type { FacetRecord } from "@/lib/showtime/facets";
import { resolveCsvRows, CSV_MAX_ROWS, type CsvRowError } from "@/lib/showtime/csv";
import { timeInSlot } from "@/lib/showtime/slots";
import { overlaps, showtimeEnd, vietnamDayStart, vietnamInstant } from "@/lib/showtime/time";
import { isCalendarDate, objectIdField } from "@/lib/validation/fields";
import { Auditorium } from "@/models/auditorium";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { Format } from "@/models/format";
import { Holiday } from "@/models/holiday";
import { Movie } from "@/models/movie";
import { PriceRule } from "@/models/price-rule";
import { Showtime } from "@/models/showtime";
import { recordAudit } from "@/services/audit.service";
import { resolveTicketPrice, type PriceRule as PriceRuleInfo } from "@/services/pricing/ticket-price";
import { getSystemSettings } from "@/services/settings.service";

export type ShowtimeError = "not_found" | "movie_not_found" | "auditorium_not_found" | "no_layout" | "format_not_found" | "invalid";

/* ---------- Creating showtimes ---------- */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const BULK_MAX_SHOWTIMES = 500;

/** One movie x several rooms x several days x several start times, all in one format. The form sends lists as comma-separated text. */
export const bulkShowtimeSchema = z.object({
  movieId: objectIdField,
  formatId: objectIdField,
  auditoriumIds: z
    .string({ error: "required" })
    .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, { error: "invalid" })).min(1, { error: "required" })),
  dates: z
    .string({ error: "required" })
    .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))].sort())
    .pipe(z.array(z.string().refine(isCalendarDate, { error: "invalid_date" })).min(1, { error: "required" })),
  times: z
    .string({ error: "required" })
    .transform((v) => [...new Set(v.split(/[\s,;]+/).filter(Boolean).map((s) => s.padStart(5, "0")))].sort())
    .pipe(z.array(z.string().regex(TIME, { error: "invalid" })).min(1, { error: "required" })),
  priceOverride: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number({ error: "invalid_number" }).int({ error: "invalid_number" }).min(0, { error: "out_of_range" }).max(10_000_000, { error: "out_of_range" }))
    .optional(),
});
export type BulkShowtimeInput = z.infer<typeof bulkShowtimeSchema>;

interface Candidate {
  movieId: string;
  auditoriumId: string;
  layoutId: string;
  formatId: string;
  startAt: Date;
  endAt: Date;
  priceOverride?: number;
}

/** Keeps the candidates that fit: not overlapping a stored showtime of the room, nor an earlier kept candidate. */
async function splitByOverlap<C extends Candidate>(candidates: C[]): Promise<{ fits: C[]; clashes: C[] }> {
  if (candidates.length === 0) return { fits: [], clashes: [] };
  const from = new Date(Math.min(...candidates.map((c) => c.startAt.getTime())));
  const to = new Date(Math.max(...candidates.map((c) => c.endAt.getTime())));
  const stored = await Showtime.find({
    auditoriumId: { $in: [...new Set(candidates.map((c) => c.auditoriumId))] },
    startAt: { $lt: to },
    endAt: { $gt: from },
  }).lean();
  const taken = new Map<string, { start: Date; end: Date }[]>();
  for (const s of stored) {
    const key = s.auditoriumId.toString();
    taken.set(key, [...(taken.get(key) ?? []), { start: s.startAt, end: s.endAt }]);
  }
  const fits: C[] = [];
  const clashes: C[] = [];
  for (const c of candidates) {
    const slot = { start: c.startAt, end: c.endAt };
    const list = taken.get(c.auditoriumId) ?? [];
    if (list.some((other) => overlaps(slot, other))) clashes.push(c);
    else {
      fits.push(c);
      taken.set(c.auditoriumId, [...list, slot]);
    }
  }
  return { fits, clashes };
}

export type BulkResult =
  | { ok: true; data: { created: number; skipped: number } }
  | { ok: false; error: ShowtimeError | "too_many" };

/** Creates the showtimes of a bulk form. A start that would overlap another showtime of the same room is skipped, and counted. */
export async function createShowtimesBulk(input: BulkShowtimeInput, actorId: string): Promise<BulkResult> {
  await connectToDatabase();
  const [movie, format, rooms, settings] = await Promise.all([
    Movie.findById(input.movieId).lean(),
    Format.findById(input.formatId).lean(),
    Auditorium.find({ _id: { $in: input.auditoriumIds } }).lean(),
    getSystemSettings(),
  ]);
  if (!movie) return { ok: false, error: "movie_not_found" };
  if (!format) return { ok: false, error: "format_not_found" };
  if (rooms.length !== input.auditoriumIds.length) return { ok: false, error: "auditorium_not_found" };
  if (rooms.some((room) => !room.currentLayoutId)) return { ok: false, error: "no_layout" };
  if (input.dates.length * input.times.length * rooms.length > BULK_MAX_SHOWTIMES) return { ok: false, error: "too_many" };

  const candidates: Candidate[] = [];
  for (const room of rooms) {
    for (const date of input.dates) {
      for (const time of input.times) {
        const startAt = vietnamInstant(date, time);
        if (!startAt) return { ok: false, error: "invalid" };
        candidates.push({
          movieId: input.movieId,
          auditoriumId: room._id.toString(),
          layoutId: (room.currentLayoutId as Types.ObjectId).toString(),
          formatId: input.formatId,
          startAt,
          endAt: showtimeEnd(startAt, movie.durationMin, settings.adMinutes),
          priceOverride: input.priceOverride,
        });
      }
    }
  }
  candidates.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const { fits, clashes } = await splitByOverlap(candidates);
  if (fits.length > 0) await Showtime.insertMany(fits);
  await recordAudit({
    actorId,
    action: "create",
    entity: "showtime",
    entityId: input.movieId,
    after: { movieId: input.movieId, created: fits.length, skipped: clashes.length, bulk: true },
  });
  return { ok: true, data: { created: fits.length, skipped: clashes.length } };
}

export type ImportResult =
  | { ok: true; data: { created: number } }
  | { ok: false; errors: CsvRowError[] };

/** Imports CSV text, all or nothing: one wrong line (or one overlap) and nothing is created, with every wrong line listed. */
export async function importShowtimesCsv(text: string, actorId: string): Promise<ImportResult> {
  await connectToDatabase();
  const [movies, branches, rooms, formats, settings] = await Promise.all([
    Movie.find({}, "title originalTitle durationMin").lean(),
    Branch.find({}, "name").lean(),
    Auditorium.find({}, "branchId name currentLayoutId").lean(),
    Format.find({}, "name").lean(),
    getSystemSettings(),
  ]);
  const { rows, errors } = resolveCsvRows(text, {
    movies: movies.map((m) => ({ id: m._id.toString(), title: m.title, originalTitle: m.originalTitle, durationMin: m.durationMin })),
    branches: branches.map((b) => ({ id: b._id.toString(), name: b.name })),
    auditoriums: rooms.map((r) => ({ id: r._id.toString(), branchId: r.branchId.toString(), name: r.name, currentLayoutId: r.currentLayoutId?.toString() ?? null })),
    formats: formats.map((f) => ({ id: f._id.toString(), name: f.name })),
  });
  if (errors.length > 0) return { ok: false, errors };
  if (rows.length === 0) return { ok: false, errors: [{ line: 1, code: "columns" }] };

  const candidates = rows.map((row) => ({
    line: row.line,
    movieId: row.movieId,
    auditoriumId: row.auditoriumId,
    layoutId: row.layoutId,
    formatId: row.formatId,
    startAt: row.startAt,
    endAt: showtimeEnd(row.startAt, row.durationMin, settings.adMinutes),
    priceOverride: row.priceOverride,
  }));
  const { fits, clashes } = await splitByOverlap(candidates);
  if (clashes.length > 0) return { ok: false, errors: clashes.map((c) => ({ line: c.line, code: "overlap" as const })).sort((a, b) => a.line - b.line) };

  await Showtime.insertMany(
    fits.map((c) => ({ movieId: c.movieId, auditoriumId: c.auditoriumId, layoutId: c.layoutId, formatId: c.formatId, startAt: c.startAt, endAt: c.endAt, priceOverride: c.priceOverride })),
  );
  await recordAudit({ actorId, action: "create", entity: "showtime", entityId: new Types.ObjectId().toString(), after: { created: fits.length, csv: true } });
  return { ok: true, data: { created: fits.length } };
}

export { CSV_MAX_ROWS };

export async function removeShowtime(id: string, actorId: string): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const before = await Showtime.findByIdAndDelete(id).lean();
  if (!before) return { ok: false, error: "not_found" };
  await recordAudit({ actorId, action: "delete", entity: "showtime", entityId: id, before });
  return { ok: true };
}

/* ---------- Reading showtimes ---------- */

export interface ShowtimeRow {
  id: string;
  movie: { id: string; title: string; posterUrl: string | null; durationMin: number };
  branch: { id: string; name: string; brandName: string };
  auditorium: { id: string; name: string };
  layoutId: string;
  format: { id: string; name: string };
  /** ISO strings: this goes to client components. */
  startAt: string;
  endAt: string;
  /** Whole dong; the standard seat's price for this showtime, null when no price rule matches yet. */
  price: number | null;
  /** Lowest and highest price over the seat types the room really has (equal when there is one price); null when none has a price. */
  priceMin: number | null;
  priceMax: number | null;
}

export interface ShowtimeFilters {
  /** Vietnam day YYYY-MM-DD; without it, everything from now on. */
  date?: string;
  movieId?: string;
  branchId?: string;
  genreId?: string;
  formatId?: string;
  /** Id of a time slot from the system settings; an id that no longer exists filters nothing. */
  slot?: string;
  /** The admin view: also shows what started in the last hours, and showtimes hidden from users by an off switch. */
  admin?: boolean;
  limit?: number;
}

export async function loadPricing() {
  const [rules, holidays] = await Promise.all([PriceRule.find({}).lean(), Holiday.find({}, "date").lean()]);
  const info: PriceRuleInfo[] = rules.map((r) => ({
    id: r._id.toString(),
    brandId: r.brandId?.toString(),
    branchId: r.branchId?.toString(),
    formatId: r.formatId?.toString(),
    seatTypeId: r.seatTypeId?.toString(),
    dayType: r.dayType ?? undefined,
    weekday: r.weekday ?? undefined,
    timeFrom: r.timeFrom ?? undefined,
    timeTo: r.timeTo ?? undefined,
    price: r.price,
    priority: r.priority,
    validFrom: r.validFrom ?? undefined,
    validTo: r.validTo ?? undefined,
    createdAt: (r as unknown as { createdAt: Date }).createdAt,
  }));
  return { rules: info, holidays: new Set(holidays.map((h) => h.date)) };
}

/**
 * One record per showtime a person can still book on a day (the same window and visibility rules as `searchShowtimes`), holding only
 * what the filters need. The browser narrows the filter choices and counts results from this list, so the sheet reacts without a round trip.
 */
export async function listShowtimeFacets(date: string): Promise<FacetRecord[]> {
  await connectToDatabase();
  const from = vietnamDayStart(date);
  if (!from) return [];
  const start = new Date(Math.max(from.getTime(), Date.now()));
  const found = await Showtime.find({ startAt: { $gte: start, $lt: new Date(from.getTime() + 24 * 3600_000) } }, "movieId auditoriumId formatId startAt")
    .limit(1000)
    .lean();
  if (found.length === 0) return [];

  const uniq = (values: Types.ObjectId[]) => [...new Set(values.map((v) => v.toString()))];
  const [movies, rooms, formats, settings] = await Promise.all([
    Movie.find({ _id: { $in: uniq(found.map((s) => s.movieId)) } }, "genreIds").lean(),
    Auditorium.find({ _id: { $in: uniq(found.map((s) => s.auditoriumId)) } }, "branchId").lean(),
    Format.find({ _id: { $in: uniq(found.map((s) => s.formatId)) } }, "active").lean(),
    getSystemSettings(),
  ]);
  const branches = await Branch.find({ _id: { $in: uniq(rooms.map((r) => r.branchId)) } }, "brandId active").lean();
  const brands = await Brand.find({ _id: { $in: uniq(branches.map((b) => b.brandId)) } }, "active").lean();

  const genresByMovie = new Map(movies.map((m) => [m._id.toString(), (m.genreIds ?? []).map((g) => g.toString())]));
  const branchByRoom = new Map(rooms.map((r) => [r._id.toString(), r.branchId.toString()]));
  const formatActive = new Map(formats.map((f) => [f._id.toString(), f.active !== false]));
  const branchById = new Map(branches.map((b) => [b._id.toString(), b]));
  const brandActive = new Map(brands.map((b) => [b._id.toString(), b.active !== false]));

  const records: FacetRecord[] = [];
  for (const s of found) {
    const branchId = branchByRoom.get(s.auditoriumId.toString());
    const branch = branchId ? branchById.get(branchId) : undefined;
    const formatId = s.formatId.toString();
    // Switched off by an admin: not shown in the list, so not offered as a choice either.
    if (!branchId || !branch || branch.active === false || brandActive.get(branch.brandId.toString()) === false || formatActive.get(formatId) === false) continue;
    const time = new Date(s.startAt.getTime() + 7 * 3600_000).toISOString().slice(11, 16);
    records.push({
      branch: branchId,
      format: formatId,
      genre: genresByMovie.get(s.movieId.toString()) ?? [],
      slot: settings.timeSlots.filter((slot) => timeInSlot(slot, time)).map((slot) => slot.id),
    });
  }
  return records;
}

/** Showtimes matching the filters, soonest first, with names joined and the estimated price. Every id is validated; a bad one matches nothing. */
export async function searchShowtimes(filters: ShowtimeFilters = {}): Promise<ShowtimeRow[]> {
  await connectToDatabase();
  const ids = [filters.movieId, filters.branchId, filters.genreId, filters.formatId].filter((v): v is string => v !== undefined);
  if (ids.some((id) => !isValidObjectId(id))) return [];

  const query: Record<string, unknown> = {};
  if (filters.date) {
    const from = vietnamDayStart(filters.date);
    if (!from) return [];
    // Today shows what has not started yet (an admin list still shows the whole day).
    const start = filters.admin ? from : new Date(Math.max(from.getTime(), Date.now()));
    query.startAt = { $gte: start, $lt: new Date(from.getTime() + 24 * 3600_000) };
  } else {
    query.startAt = { $gte: filters.admin ? new Date(Date.now() - 6 * 3600_000) : new Date() };
  }
  if (filters.movieId) query.movieId = filters.movieId;
  if (filters.formatId) query.formatId = filters.formatId;
  if (filters.genreId) {
    const movies = await Movie.find({ genreIds: filters.genreId }, "_id").lean();
    query.movieId = filters.movieId
      ? (movies.some((m) => m._id.toString() === filters.movieId) ? filters.movieId : { $in: [] })
      : { $in: movies.map((m) => m._id) };
  }
  if (filters.branchId) {
    const rooms = await Auditorium.find({ branchId: filters.branchId }, "_id").lean();
    query.auditoriumId = { $in: rooms.map((r) => r._id) };
  }

  const slot = filters.slot ? (await getSystemSettings()).timeSlots.find((candidate) => candidate.id === filters.slot) : undefined;
  const found = await Showtime.find(query).sort({ startAt: 1 }).limit((filters.limit ?? 300) * (slot ? 4 : 1)).lean();
  const inSlot = slot
    ? found.filter((s) => timeInSlot(slot, new Date(s.startAt.getTime() + 7 * 3600_000).toISOString().slice(11, 16)))
    : found;
  const rows = inSlot.slice(0, filters.limit ?? 300);
  if (rows.length === 0) return [];

  const uniq = (values: Types.ObjectId[]) => [...new Set(values.map((v) => v.toString()))];
  const [movies, rooms, formats, layouts, pricing] = await Promise.all([
    Movie.find({ _id: { $in: uniq(rows.map((r) => r.movieId)) } }, "title posterUrl durationMin").lean(),
    Auditorium.find({ _id: { $in: uniq(rows.map((r) => r.auditoriumId)) } }, "name branchId").lean(),
    Format.find({ _id: { $in: uniq(rows.map((r) => r.formatId)) } }, "name active").lean(),
    AuditoriumLayout.find({ _id: { $in: uniq(rows.map((r) => r.layoutId)) } }, "config.defaultSeatType seats.type").lean(),
    loadPricing(),
  ]);
  const branches = await Branch.find({ _id: { $in: uniq(rooms.map((r) => r.branchId)) } }, "name brandId active").lean();
  const brands = await Brand.find({ _id: { $in: uniq(branches.map((b) => b.brandId)) } }, "name active").lean();

  const movieById = new Map(movies.map((m) => [m._id.toString(), m]));
  const roomById = new Map(rooms.map((r) => [r._id.toString(), r]));
  const formatById = new Map(formats.map((f) => [f._id.toString(), f]));
  const branchById = new Map(branches.map((b) => [b._id.toString(), b]));
  const brandById = new Map(brands.map((b) => [b._id.toString(), b]));
  const seatTypeByLayout = new Map(layouts.map((l) => [l._id.toString(), (l.config as { defaultSeatType: string }).defaultSeatType]));
  // Every seat type the room has, so the price can be shown as a range (standard, VIP, couple...).
  const seatTypesByLayout = new Map(
    layouts.map((l) => [l._id.toString(), [...new Set([(l.config as { defaultSeatType: string }).defaultSeatType, ...(l.seats ?? []).map((seat) => seat.type)])]]),
  );

  const result: ShowtimeRow[] = [];
  for (const s of rows) {
    const movie = movieById.get(s.movieId.toString());
    const room = roomById.get(s.auditoriumId.toString());
    const format = formatById.get(s.formatId.toString());
    const branch = room && branchById.get(room.branchId.toString());
    if (!movie || !room || !format || !branch) continue;
    // Switched off by an admin: not shown (the admin list shows everything).
    const brand = brandById.get(branch.brandId.toString());
    if (!filters.admin && (format.active === false || branch.active === false || brand?.active === false)) continue;
    const priceOf = (seatTypeId: string) =>
      resolveTicketPrice({
        showtime: {
          startAt: s.startAt,
          brandId: branch.brandId.toString(),
          branchId: branch._id.toString(),
          formatId: s.formatId.toString(),
          seatTypeId,
        },
        rules: pricing.rules,
        holidays: pricing.holidays,
        priceOverride: s.priceOverride ?? undefined,
      })?.price;
    const price = priceOf(seatTypeByLayout.get(s.layoutId.toString()) ?? "");
    const seatTypeIds = seatTypesByLayout.get(s.layoutId.toString());
    // A layout that cannot be read leaves the one price we have as the whole range.
    const prices = seatTypeIds ? seatTypeIds.map((id) => priceOf(id)).filter((value): value is number => value !== undefined) : price === undefined ? [] : [price];
    result.push({
      id: s._id.toString(),
      movie: { id: movie._id.toString(), title: movie.title, posterUrl: movie.posterUrl ?? null, durationMin: movie.durationMin },
      branch: { id: branch._id.toString(), name: branch.name, brandName: brand?.name ?? "" },
      auditorium: { id: room._id.toString(), name: room.name },
      layoutId: s.layoutId.toString(),
      format: { id: format._id.toString(), name: format.name },
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      price: price ?? null,
      priceMin: prices.length > 0 ? Math.min(...prices) : null,
      priceMax: prices.length > 0 ? Math.max(...prices) : null,
    });
  }
  return result;
}

/**
 * The showtimes of one movie on the same day as `after`, starting at `after` or later (soonest first), with the same visibility rules
 * as `searchShowtimes`. Used when someone types the time they want to watch and then picks a showtime from what is on from then.
 */
export async function searchShowtimesFrom(movieId: string, after: Date): Promise<ShowtimeRow[]> {
  if (Number.isNaN(after.getTime()) || after.getTime() <= Date.now()) return [];
  const day = new Date(after.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const rows = await searchShowtimes({ movieId, date: day, limit: 300 });
  return rows.filter((row) => new Date(row.startAt).getTime() >= after.getTime());
}

/**
 * Movies a person could actually watch: at least one showtime that has not started, in a cinema and format that are switched on
 * (the same rule `searchShowtimes` uses for users). A movie with none is left out of lists where picking it would lead nowhere.
 */
export async function listMovieIdsWithShowtimes(): Promise<Set<string>> {
  await connectToDatabase();
  const upcoming = await Showtime.find({ startAt: { $gte: new Date() } }, "movieId auditoriumId formatId").lean();
  if (upcoming.length === 0) return new Set();

  const uniq = (values: Types.ObjectId[]) => [...new Set(values.map((v) => v.toString()))];
  const [rooms, formats] = await Promise.all([
    Auditorium.find({ _id: { $in: uniq(upcoming.map((s) => s.auditoriumId)) } }, "branchId").lean(),
    Format.find({ _id: { $in: uniq(upcoming.map((s) => s.formatId)) } }, "active").lean(),
  ]);
  const branches = await Branch.find({ _id: { $in: uniq(rooms.map((r) => r.branchId)) } }, "brandId active").lean();
  const brands = await Brand.find({ _id: { $in: uniq(branches.map((b) => b.brandId)) } }, "active").lean();

  // A record with no value (made before the switch existed) counts as on.
  const on = (doc: { active?: boolean | null } | undefined) => doc !== undefined && doc.active !== false;
  const roomById = new Map(rooms.map((r) => [r._id.toString(), r]));
  const formatById = new Map(formats.map((f) => [f._id.toString(), f]));
  const branchById = new Map(branches.map((b) => [b._id.toString(), b]));
  const brandById = new Map(brands.map((b) => [b._id.toString(), b]));

  const ids = new Set<string>();
  for (const s of upcoming) {
    const room = roomById.get(s.auditoriumId.toString());
    const branch = room && branchById.get(room.branchId.toString());
    if (!branch || !on(formatById.get(s.formatId.toString())) || !on(branch) || !on(brandById.get(branch.brandId.toString()))) continue;
    ids.add(s.movieId.toString());
  }
  return ids;
}
