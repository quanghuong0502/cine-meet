import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { landingPathForRole } from "@/lib/post-login";

/** Right after signing in: admins go to the admin area, everyone else to the app. Renders nothing. */
export default async function PostLoginPage() {
  // Sends someone who must change their temporary password to /change-password first.
  const user = await requireUser();
  redirect(landingPathForRole(user.role));
}
