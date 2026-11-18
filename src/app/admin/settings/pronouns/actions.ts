"use server";

import { revalidatePath, updateTag } from "next/cache";
import { errorState, type SaveState } from "@/lib/admin/action-result";
import { requireAdmin } from "@/lib/auth/guards";
import { PRONOUNS_TAG } from "@/services/pronouns-cache";
import { savePronouns } from "@/services/pronouns.service";

/** The admin comes from the session, never from the form. Both words are checked again here, not only in the form. */
export async function savePronounsAction(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const you = formData.get("you");
  const me = formData.get("me");
  // A switch sends "on" when it is on and nothing when it is off.
  const result = await savePronouns(
    { you: typeof you === "string" ? you : "", me: typeof me === "string" ? me : "", youIsName: formData.get("youIsName") === "on", meIsName: formData.get("meIsName") === "on" },
    admin.userId,
  );
  if (!result.ok) return errorState(formData, "validation", result.fieldErrors);

  // Every screen speaks the new pair: drop the cached pair and the client's cached pages.
  updateTag(PRONOUNS_TAG);
  revalidatePath("/", "layout");
  return { status: "success" };
}
