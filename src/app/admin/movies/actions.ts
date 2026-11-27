"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { errorState, parseForm, type RemoveResult, type SaveState } from "@/lib/admin/action-result";
import { CATALOG_MOVIES_TAG } from "@/lib/cache";
import { movieInputSchema, movieService } from "@/services/movie.service";
import {
  bulkShowtimeSchema, createShowtimesBulk, importShowtimesCsv, removeShowtime, removeShowtimesBulk, type ShowtimeError,
} from "@/services/showtime.service";
import type { CsvRowError } from "@/lib/showtime/csv";

/** Everything the user app shows about movies and showtimes; one call clears cached tags and routes. */
function refreshMovies() {
  updateTag(CATALOG_MOVIES_TAG);
  revalidatePath("/admin/movies", "layout");
  revalidatePath("/showtimes", "layout");
  revalidatePath("/movies", "layout");
  revalidatePath("/cinemas", "layout");
  revalidatePath("/log-viewing");
  revalidatePath("/appointments/new");
}

export async function saveMovie(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const parsed = parseForm(movieInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  const id = formData.get("id");
  const result =
    typeof id === "string" && id !== ""
      ? await movieService.update(id, parsed.data, admin.userId)
      : await movieService.create(parsed.data, admin.userId);
  if (!result.ok) return errorState(formData, result.error);
  refreshMovies();
  return { status: "success" };
}

export async function removeMovie(id: string): Promise<RemoveResult> {
  const admin = await requireAdmin();
  const result = await movieService.remove(id, admin.userId);
  if (!result.ok) return result;
  refreshMovies();
  return { ok: true };
}

export async function removeShowtimeAction(id: string): Promise<RemoveResult> {
  const admin = await requireAdmin();
  const result = await removeShowtime(id, admin.userId);
  if (!result.ok) return result;
  refreshMovies();
  return { ok: true };
}

export async function removeShowtimesBulkAction(
  ids: string[],
): Promise<{ ok: true; deleted: number; skipped: number } | { ok: false; error: "unknown" }> {
  const admin = await requireAdmin();
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true, deleted: 0, skipped: 0 };
  const result = await removeShowtimesBulk(ids.filter((id): id is string => typeof id === "string"), admin.userId);
  if (result.deleted > 0) refreshMovies();
  return result;
}

export type BulkState =
  | { status: "idle" }
  | { status: "success"; created: number; skipped: number }
  | { status: "error"; error: ShowtimeError | "validation" | "too_many"; fieldErrors?: Record<string, string>; values?: Record<string, string> };

export async function createShowtimesAction(_previous: BulkState, formData: FormData): Promise<BulkState> {
  const admin = await requireAdmin();
  const parsed = parseForm(bulkShowtimeSchema, formData);
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
  if (!parsed.ok) return { status: "error", error: "validation", fieldErrors: parsed.fieldErrors, values };

  const result = await createShowtimesBulk(parsed.data, admin.userId);
  if (!result.ok) return { status: "error", error: result.error, values };
  refreshMovies();
  return { status: "success", ...result.data };
}

export type ImportState =
  | { status: "idle" }
  | { status: "success"; created: number }
  | { status: "error"; errors: CsvRowError[]; text: string };

export async function importShowtimesAction(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const text = formData.get("csv");
  const csv = typeof text === "string" ? text : "";
  if (csv.trim() === "") return { status: "error", errors: [{ line: 1, code: "columns" }], text: csv };
  const result = await importShowtimesCsv(csv, admin.userId);
  if (!result.ok) return { status: "error", errors: result.errors, text: csv };
  refreshMovies();
  return { status: "success", created: result.data.created };
}
