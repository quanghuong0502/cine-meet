import { signOut } from "@/auth";

/** Clears the session cookie of an account that was locked or removed, then shows the login page. */
export async function GET(): Promise<void> {
  await signOut({ redirectTo: "/login?error=session_expired" });
}
