"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { RemoveResult, SaveError } from "@/lib/admin/action-result";
import { requireAdmin } from "@/lib/auth/guards";
import { CATALOG_CINEMAS_TAG } from "@/lib/cache";
import { createAuditorium, removeAuditorium, updateAuditorium } from "@/services/auditorium.service";

const PAGE = "/admin/auditoriums";

function refreshAuditoriums(id?: string) {
  updateTag(CATALOG_CINEMAS_TAG);
  revalidatePath(PAGE);
  if (id) revalidatePath(`${PAGE}/${id}`);
  revalidatePath("/cinemas", "layout");
  revalidatePath("/showtimes");
}

const inputSchema = z.object({
  id: z.string().optional(),
  branchId: z.string().min(1, { error: "required" }),
  name: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(60, { error: "too_long" }),
  config: z.unknown(),
});

export type SaveAuditoriumResult =
  | { status: "success"; id: string; version: number; createdVersion: boolean }
  | { status: "error"; error: SaveError; fieldErrors?: Record<string, string> };

/**
 * Saves a room: creates it (no `id`) or saves its layout (a changed layout becomes a new version). The admin comes from the
 * session; the layout config is validated again by the service, so nothing the browser sends is trusted.
 */
export async function saveAuditoriumAction(input: z.input<typeof inputSchema>): Promise<SaveAuditoriumResult> {
  const admin = await requireAdmin();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message === "too_long" ? "too_long" : "required";
    return { status: "error", error: "validation", fieldErrors };
  }
  const { id, branchId, name, config } = parsed.data;

  if (id) {
    const result = await updateAuditorium(id, { name, config }, admin.userId);
    if (!result.ok) return { status: "error", error: result.error };
    refreshAuditoriums(id);
    return { status: "success", id, version: result.data.version, createdVersion: result.data.createdVersion };
  }
  const result = await createAuditorium({ branchId, name, config }, admin.userId);
  if (!result.ok) return { status: "error", error: result.error };
  refreshAuditoriums();
  return { status: "success", id: result.data.id, version: 1, createdVersion: true };
}

export async function removeAuditoriumAction(id: string): Promise<RemoveResult> {
  const admin = await requireAdmin();
  const result = await removeAuditorium(id, admin.userId);
  if (!result.ok) return result;
  refreshAuditoriums();
  return { ok: true };
}
