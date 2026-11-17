"use server";

import { cloudinaryConfig, createBranchImageUploadTicket, createBrandLogoUploadTicket, createMoviePosterUploadTicket } from "@/lib/cloudinary";
import { requireAdmin } from "@/lib/auth/guards";
import type { TicketResult } from "@/lib/upload-types";

/** A signed ticket for uploading a brand logo; only an admin can get one. */
export async function getBrandLogoUploadTicket(): Promise<TicketResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "not_configured" };
  return { ok: true, ticket: createBrandLogoUploadTicket(config) };
}

/** A signed ticket for uploading a branch photo; only an admin can get one. */
export async function getBranchImageUploadTicket(): Promise<TicketResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "not_configured" };
  return { ok: true, ticket: createBranchImageUploadTicket(config) };
}

/** A signed ticket for uploading a movie poster; only an admin can get one. */
export async function getMoviePosterUploadTicket(): Promise<TicketResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "not_configured" };
  return { ok: true, ticket: createMoviePosterUploadTicket(config) };
}
