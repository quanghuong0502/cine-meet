/**
 * Where an entry screen sends the person back to: the list they came from (kept in `?back=`), so the tab and search survive.
 * Only paths inside the Catalog are accepted, so the parameter can never point somewhere else.
 */
export function resolveBackHref(back: string | undefined, fallback: string): string {
  if (!back) return fallback;
  if (!back.startsWith("/admin/master-data")) return fallback;
  if (back.startsWith("//") || back.includes("\\")) return fallback;
  return back;
}
