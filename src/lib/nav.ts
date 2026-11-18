import {
  CalendarHeart,
  Clapperboard,
  LayoutDashboard,
  MessageCircle,
  Popcorn,
  type LucideIcon,
} from "lucide-react";

/** Keys of `nav.*` in src/messages/*.json: the label is translated where the tab is rendered. */
export type NavKey = "overview" | "showtimes" | "appointments" | "cinemas" | "chat";

export interface NavItem {
  href: string;
  key: NavKey;
  icon: LucideIcon;
  /** Turned on in the sprint that delivers the feature; disabled tabs stay hidden. */
  enabled: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "overview", icon: LayoutDashboard, enabled: false }, // Sprint 6
  { href: "/showtimes", key: "showtimes", icon: Clapperboard, enabled: true },
  { href: "/appointments", key: "appointments", icon: CalendarHeart, enabled: true },
  { href: "/cinemas", key: "cinemas", icon: Popcorn, enabled: true },
  { href: "/chat", key: "chat", icon: MessageCircle, enabled: false }, // Sprint 7
];

export const ENABLED_NAV_ITEMS = NAV_ITEMS.filter((item) => item.enabled);

/** Entry screens (such as editing the profile) hide the bottom bar: the Save button takes its place. */
export function isFocusedUserRoute(pathname: string): boolean {
  return /^\/profile\/.+/.test(pathname) || pathname === "/appointments/new";
}

/**
 * Root screens of the user app: the ones that show the app bar (logo and avatar). Every other screen is an inner screen with its own
 * back bar, so a second bar above it would only waste height.
 */
export function isUserTabRoot(pathname: string): boolean {
  return pathname === "/" || ENABLED_NAV_ITEMS.some((item) => item.href === pathname);
}
