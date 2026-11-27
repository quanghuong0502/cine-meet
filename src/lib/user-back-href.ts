/**
 * Validates an optional `?back=` query param for user-area screens so installed PWAs
 * can return to the exact screen (and filter query) the user came from without open redirects.
 */
const ALLOWED_USER_PREFIXES = [
  "/",
  "/showtimes",
  "/movies",
  "/appointments",
  "/cinemas",
  "/profile",
  "/settings",
  "/friends",
  "/notifications",
  "/log-viewing",
];

export function resolveUserBackHref(back: string | string[] | undefined, fallback: string): string {
  const value = Array.isArray(back) ? back[0] : back;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (value.startsWith("/api/") || value.startsWith("/admin")) return fallback;
  if (value === "/" || value.startsWith("/?")) return value;
  const ok = ALLOWED_USER_PREFIXES.some(
    (prefix) => prefix !== "/" && (value === prefix || value.startsWith(`${prefix}?`) || value.startsWith(`${prefix}/`)),
  );
  return ok ? value : fallback;
}
