"use server";

import { revalidatePath } from "next/cache";
import { errorState, parseForm, type SaveState } from "@/lib/admin/action-result";
import { cloudinaryConfig, createAvatarUploadTicket, isOwnAvatarUrl, type AvatarUploadTicket } from "@/lib/cloudinary";
import { requireUser } from "@/lib/auth/guards";
import { profileInputSchema, updateProfile } from "@/services/profile.service";

/** The person comes from the session, never from the form: nobody can edit someone else's profile. */
export async function saveProfileAction(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireUser();
  const parsed = parseForm(profileInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  // A picture is only accepted when it is this person's own upload on our Cloudinary account.
  const config = cloudinaryConfig();
  if (parsed.data.avatar && !(config && isOwnAvatarUrl(parsed.data.avatar, user.userId, config))) {
    return errorState(formData, "validation", { avatar: "invalid" });
  }

  const result = await updateProfile(user.userId, parsed.data);
  if (!result.ok) {
    return result.error === "phone_taken"
      ? errorState(formData, "validation", { phone: "taken" })
      : errorState(formData, result.error);
  }
  revalidatePath("/", "layout");
  return { status: "success" };
}

export type AvatarTicketResult = { ok: true; ticket: AvatarUploadTicket } | { ok: false; error: "not_configured" };

/** A signed ticket to upload the signed-in person's avatar straight to Cloudinary. */
export async function getAvatarUploadTicket(): Promise<AvatarTicketResult> {
  const user = await requireUser();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "not_configured" };
  return { ok: true, ticket: createAvatarUploadTicket(user.userId, config) };
}
