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
  // "//host" and "/\host" are treated as absolute URLs by browsers; API routes must never be post-login destinations.
  if (
    target.startsWith("//") ||
    target.startsWith("/\\") ||
    target === "/api" ||
    target.startsWith("/api/") ||
    target.startsWith("/api?")
  ) {
    return fallback;
  }
  return target;
}
