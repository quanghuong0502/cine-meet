/**
 * Zero-dependency route matchers shared by `NetworkWatcher` (root layout) and the user/admin navigation shells.
 * Kept separate from `nav.ts` and `admin-nav.ts` so the root layout never pulls their Solar icon imports into `/login` or other lightweight routes.
 */

/** Entry screens (such as editing the profile) hide the bottom bar: the Save button takes its place. */
export function isFocusedUserRoute(pathname: string): boolean {
  return (
    /^\/profile\/.+/.test(pathname) ||
    /^\/friends\/groups\/.+/.test(pathname) ||
    pathname === "/appointments/new" ||
    pathname === "/log-viewing"
  );
}

/**
 * Entry screens (a master-data record, later user and room forms) hide the bottom bar, as iOS does for a pushed screen:
 * the Save button takes its place and the person is working on one thing. Their parent list is the page just above them.
 */
export function isFocusedAdminRoute(pathname: string): boolean {
  // The showtimes list itself is a tab of the Movies page and keeps the bar; its entry screens (bulk, import) hide it.
  return (
    /^\/admin\/(master-data|users|auditoriums)\/.+/.test(pathname) ||
    /^\/admin\/movies\/(?!showtimes$).+/.test(pathname) ||
    pathname.startsWith("/admin/settings/") ||
    pathname === "/admin/profile" ||
    pathname.startsWith("/admin/profile/")
  );
}
