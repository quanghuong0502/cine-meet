import {
  Clapperboard,
  Database,
  LayoutDashboard,
  Projector,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Keys of `admin.nav.*` and `admin.bottomNav.*` in src/messages/*.json. */
export type AdminNavKey = "overview" | "users" | "masterData" | "auditoriums" | "movies" | "settings";

export interface AdminNavItem {
  href: string;
  key: AdminNavKey;
  icon: LucideIcon;
  /** Turned on in the sprint that delivers the page. Pages that are not ready yet stay out of every menu. */
  enabled: boolean;
  /** Link is active only on this exact path (the root page). */
  exact?: boolean;
}

/**
 * Every admin page that can appear in a menu. All master-data settings live on the single "Catalog" page (as tabs),
 * so one link covers them. The phone bottom bar shows at most 5 enabled pages; when more are ready, move the least used into the avatar menu.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", key: "overview", icon: LayoutDashboard, enabled: false, exact: true }, // later: dashboard
  { href: "/admin/users", key: "users", icon: Users, enabled: true },
  { href: "/admin/master-data", key: "masterData", icon: Database, enabled: true },
  { href: "/admin/auditoriums", key: "auditoriums", icon: Projector, enabled: true },
  { href: "/admin/movies", key: "movies", icon: Clapperboard, enabled: false }, // Sprint 3
  { href: "/admin/settings", key: "settings", icon: Settings, enabled: true },
];

export const ENABLED_ADMIN_NAV_ITEMS = ADMIN_NAV_ITEMS.filter((item) => item.enabled);

/** The bottom bar is only worth showing with at least two destinations. */
export const MIN_BOTTOM_NAV_ITEMS = 2;
export const MAX_BOTTOM_NAV_ITEMS = 5;

/**
 * Entry screens (a master-data record, later user and room forms) hide the bottom bar, as iOS does for a pushed screen:
 * the Save button takes its place and the person is working on one thing. Their parent list is the page just above them.
 */
export function isFocusedAdminRoute(pathname: string): boolean {
  return /^\/admin\/(master-data|users|auditoriums)\/.+/.test(pathname) || pathname.startsWith("/admin/settings/") || pathname.startsWith("/admin/profile/");
}

/** The bottom bar shows on every page except entry screens, and also while an entry screen is still loading (`holding`). */
export function showsAdminBar(pathname: string, holding: boolean): boolean {
  return !isFocusedAdminRoute(pathname) || holding;
}
