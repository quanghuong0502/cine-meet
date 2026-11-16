import type { UserRole } from "@/lib/user-constants";

/**
 * Where a person lands right after signing in. Kept free of framework imports so the edge proxy can use it too.
 * /post-login looks at the role and sends admins to the admin area and everyone else to the app.
 */
export const POST_LOGIN_PATH = "/post-login";

export function landingPathForRole(role: UserRole): string {
  return role === "admin" ? "/admin" : "/";
}

/**
 * A plain sign-in (no specific page requested, so the target is "/") goes through /post-login to pick the landing page by role.
 * When someone was heading to a particular page (e.g. bounced to /login from /admin/users) that page is kept.
 */
export function resolvePostLoginTarget(target: string): string {
  return target === "/" ? POST_LOGIN_PATH : target;
}
