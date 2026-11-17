import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findActiveUserById, type ActiveUser } from "@/services/user.service";

/** Route that clears the session cookie, then sends the user to /login. */
export const INVALID_SESSION_PATH = "/api/session/invalid";
export const CHANGE_PASSWORD_PATH = "/change-password";

/**
 * Reads the signed-in user from the database on every call, so locking an account or changing a role
 * takes effect on the very next request even though the JWT is still valid.
 * Proxy (edge) can only read the JWT; real access decisions happen here.
 * The only trusted source of `userId` and `role`: never take them from a body, query or AI tool.
 */
export async function getActiveUser(): Promise<ActiveUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return loadActiveUser(session.user.id);
}

/**
 * One database read per rendered request, shared by the language lookup, the layout and the page (React `cache` lasts only for one
 * render, never across requests, so a lock or role change still takes effect on the next request). Outside a render, such as in a
 * server action, it is not cached, so an action always reads fresh data.
 */
const loadActiveUser = cache((id: string) => findActiveUserById(id));

interface RequireUserOptions {
  /** Set only on the change-password page itself, to avoid a redirect loop. */
  allowPasswordChange?: boolean;
}

/** For pages, layouts and server actions: returns the active user or redirects. */
export async function requireUser(options: RequireUserOptions = {}): Promise<ActiveUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await loadActiveUser(session.user.id);
  // Valid JWT but the account is gone or locked: drop the cookie, otherwise /login would bounce back here.
  if (!user) redirect(INVALID_SESSION_PATH);

  if (user.mustChangePassword && !options.allowPasswordChange) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  return user;
}

/** Same as `requireUser` but only for admins; other users are sent to the home page. */
export async function requireAdmin(): Promise<ActiveUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
