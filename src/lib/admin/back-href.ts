/**
 * Where an entry screen sends the person back to: the list they came from (kept in `?back=`), so the tab and search survive.
 * Only list pages of the Catalog, users and auditoriums are accepted, so the parameter can never point somewhere else.
 */
const ALLOWED_PREFIXES = ["/admin/master-data", "/admin/users", "/admin/auditoriums"];

export function resolveBackHref(back: string | undefined, fallback: string): string {
  if (!back) return fallback;
  if (!ALLOWED_PREFIXES.some((prefix) => back === prefix || back.startsWith(`${prefix}?`) || back.startsWith(`${prefix}/`))) return fallback;
  if (back.startsWith("//") || back.includes("\\")) return fallback;
  return back;
}
