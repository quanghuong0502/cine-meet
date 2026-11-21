import {
  CalendarHeart,
  Clapperboard,
  LayoutDashboard,
  MessageCircle,
  Popcorn,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/** Keys of `nav.*` in src/messages/*.json: the label is translated where the tab is rendered. */
export type NavKey = "overview" | "showtimes" | "appointments" | "cinemas" | "chat" | "profile";

export interface NavItem {
  href: string;
  key: NavKey;
  icon: LucideIcon;
  /** Turned on in the sprint that delivers the feature; disabled tabs stay hidden. */
  enabled: boolean;
  /** Other places that belong to this tab (the tab stays lit there): Settings and Friends are opened from Profile. */
  alsoActive?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "overview", icon: LayoutDashboard, enabled: true },
  { href: "/showtimes", key: "showtimes", icon: Clapperboard, enabled: true },
  { href: "/appointments", key: "appointments", icon: CalendarHeart, enabled: true },
  { href: "/cinemas", key: "cinemas", icon: Popcorn, enabled: true },
  { href: "/chat", key: "chat", icon: MessageCircle, enabled: false }, // Sprint 7
  { href: "/profile", key: "profile", icon: UserRound, enabled: true, alsoActive: ["/settings", "/friends"] },
];

export const ENABLED_NAV_ITEMS = NAV_ITEMS.filter((item) => item.enabled);

/** Entry screens (such as editing the profile) hide the bottom bar: the Save button takes its place. */
export function isFocusedUserRoute(pathname: string): boolean {
  return /^\/profile\/.+/.test(pathname) || pathname === "/appointments/new" || pathname === "/log-viewing";
}

/**
 * Root screens of the user app: the ones that show the app bar (logo and avatar). Every other screen is an inner screen with its own
 * back bar, so a second bar above it would only waste height.
 */
export function isUserTabRoot(pathname: string): boolean {
  return pathname === "/" || ENABLED_NAV_ITEMS.some((item) => item.href === pathname);
}
