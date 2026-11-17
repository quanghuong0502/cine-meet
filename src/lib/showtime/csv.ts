import { vietnamInstant } from "./time";

/** Splits CSV text into rows of cells. Handles quotes (with "" inside), and `,` `;` or tab as the separator (chosen from the first line). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

/** Lower case, no accents, single spaces: "Phòng  1" and "phong 1" match. */
export function normalizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type CsvErrorCode =
  | "columns"
  | "movie_not_found"
  | "movie_ambiguous"
  | "branch_not_found"
  | "branch_ambiguous"
  | "auditorium_not_found"
  | "no_layout"
  | "format_not_found"
  | "invalid_start"
  | "invalid_price"
  | "overlap"
  | "too_many";

export interface CsvRowError {
  /** Line number in the file (the header is line 1). */
  line: number;
  code: CsvErrorCode;
  /** The offending cell, shown to the admin. */
  value?: string;
}

export interface CsvLookups {
  movies: { id: string; title: string; originalTitle?: string | null; durationMin: number }[];
  branches: { id: string; name: string }[];
  auditoriums: { id: string; branchId: string; name: string; currentLayoutId: string | null }[];
  formats: { id: string; name: string }[];
}

export interface ResolvedShowtime {
  line: number;
  movieId: string;
  durationMin: number;
  auditoriumId: string;
  layoutId: string;
  formatId: string;
  startAt: Date;
  priceOverride?: number;
}

export const CSV_COLUMNS = ["movie", "branch", "auditorium", "start", "format", "price"] as const;
export const CSV_MAX_ROWS = 500;

/** Header row (any of the column names, in any language we document) is optional: it is skipped when the first cell says "movie". */
function stripHeader(rows: string[][]): { rows: string[][]; firstLine: number } {
  const first = rows[0]?.[0] ? normalizeName(rows[0][0]) : "";
  return ["movie", "phim"].includes(first) ? { rows: rows.slice(1), firstLine: 2 } : { rows, firstLine: 1 };
}

/**
 * Turns CSV rows into showtimes to create, or says exactly which line is wrong and why. Pure: no database.
 * Columns: movie, branch, auditorium, start (YYYY-MM-DD HH:mm, Vietnam time), format, price (optional, whole dong).
 */
export function resolveCsvRows(text: string, lookups: CsvLookups): { rows: ResolvedShowtime[]; errors: CsvRowError[] } {
  const { rows: body, firstLine } = stripHeader(parseCsv(text));
  const errors: CsvRowError[] = [];
  const rows: ResolvedShowtime[] = [];
  if (body.length > CSV_MAX_ROWS) return { rows, errors: [{ line: firstLine + CSV_MAX_ROWS, code: "too_many" }] };

  const group = <T>(items: T[], key: (item: T) => string[]) => {
    const map = new Map<string, T[]>();
    for (const item of items) for (const k of key(item)) map.set(k, [...(map.get(k) ?? []), item]);
    return map;
  };
  const movies = group(lookups.movies, (m) => [normalizeName(m.title), ...(m.originalTitle ? [normalizeName(m.originalTitle)] : [])]);
  const branches = group(lookups.branches, (b) => [normalizeName(b.name)]);
  const formats = group(lookups.formats, (f) => [normalizeName(f.name)]);

  body.forEach((cells, index) => {
    const line = firstLine + index;
    const fail = (code: CsvErrorCode, value?: string) => errors.push({ line, code, value });
    if (cells.length < 5) return fail("columns");
    const [movieName, branchName, roomName, start, formatName, price] = cells;

    const movie = movies.get(normalizeName(movieName)) ?? [];
    if (movie.length === 0) return fail("movie_not_found", movieName);
    if (new Set(movie.map((m) => m.id)).size > 1) return fail("movie_ambiguous", movieName);

    const branch = branches.get(normalizeName(branchName)) ?? [];
    if (branch.length === 0) return fail("branch_not_found", branchName);
    if (branch.length > 1) return fail("branch_ambiguous", branchName);

    const room = lookups.auditoriums.find((a) => a.branchId === branch[0].id && normalizeName(a.name) === normalizeName(roomName));
    if (!room) return fail("auditorium_not_found", roomName);
    if (!room.currentLayoutId) return fail("no_layout", roomName);

    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})$/.exec(start);
    const startAt = match ? vietnamInstant(match[1], match[2].padStart(5, "0")) : null;
    if (!startAt) return fail("invalid_start", start);

    const format = formats.get(normalizeName(formatName)) ?? [];
    if (format.length === 0) return fail("format_not_found", formatName);

    let priceOverride: number | undefined;
    if (price) {
      const value = Number(price.replace(/[.,\s]/g, ""));
      if (!Number.isInteger(value) || value < 0 || value > 10_000_000) return fail("invalid_price", price);
      priceOverride = value;
    }

    rows.push({
      line,
      movieId: movie[0].id,
      durationMin: movie[0].durationMin,
      auditoriumId: room.id,
      layoutId: room.currentLayoutId,
      formatId: format[0].id,
      startAt,
      priceOverride,
    });
  });
  return { rows, errors };
}
