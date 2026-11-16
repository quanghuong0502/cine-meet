/**
 * Returns `target` only when it is a same-origin relative path; otherwise `fallback`.
 * Guards the post-login redirect against open-redirect attacks.
 */
export function getSafeRedirectPath(
  target: string | null | undefined,
  fallback = "/",
): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback;
  // "//host" and "/\host" are treated as absolute URLs by browsers.
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
