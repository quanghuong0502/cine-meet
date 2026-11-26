"use server";

import { revalidatePath } from "next/cache";
import { errorState, parseForm, type RemoveResult, type SaveState } from "@/lib/admin/action-result";
import { requireAdmin } from "@/lib/auth/guards";
import type { UserStatus } from "@/lib/user-constants";
import {
  createUser,
  createUserInputSchema,
  resetPassword,
  resetPasswordInputSchema,
  setUserStatus,
  updateUser,
  updateUserInputSchema,
} from "@/services/admin-user.service";

const PAGE = "/admin/users";

/** Every action takes the admin from the session, never from the form. */
export async function createUserAction(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const parsed = parseForm(createUserInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  const result = await createUser(parsed.data, admin.userId);
  if (!result.ok) return errorState(formData, result.error);
  revalidatePath(PAGE);
  return { status: "success" };
}

export async function updateUserAction(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const parsed = parseForm(updateUserInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  const id = formData.get("id");
  if (typeof id !== "string") return errorState(formData, "not_found");
  const result = await updateUser(id, parsed.data, admin.userId);
  if (!result.ok) return errorState(formData, result.error);
  revalidatePath(PAGE);
  revalidatePath(`${PAGE}/${id}`);
  return { status: "success" };
}

export async function resetPasswordAction(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const parsed = parseForm(resetPasswordInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  const id = formData.get("id");
  if (typeof id !== "string") return errorState(formData, "not_found");
  const result = await resetPassword(id, parsed.data.temporaryPassword, admin.userId);
  if (!result.ok) return errorState(formData, result.error);
  revalidatePath(PAGE);
  revalidatePath(`${PAGE}/${id}`);
  return { status: "success" };
}

export async function setUserStatusAction(id: string, status: UserStatus): Promise<RemoveResult> {
  const admin = await requireAdmin();
  if (status !== "active" && status !== "locked") return { ok: false, error: "unknown" };
  const result = await setUserStatus(id, status, admin.userId);
  if (!result.ok) return result;
  revalidatePath(PAGE);
  revalidatePath(`${PAGE}/${id}`);
  return { ok: true };
}
