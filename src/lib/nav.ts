import type { Icon as SolarIcon } from "@solar-icons/react/lib/types";
import {
  Armchair2Icon,
  CalendarMarkIcon,
  ChatRoundLikeIcon,
  ClapperboardPlayIcon,
  HomeSmileIcon,
  UserRoundedIcon,
} from "@solar-icons/react/linear";
import {
  Armchair2Icon as Armchair2ActiveIcon,
  CalendarMarkIcon as CalendarMarkActiveIcon,
  ChatRoundLikeIcon as ChatRoundLikeActiveIcon,
  ClapperboardPlayIcon as ClapperboardPlayActiveIcon,
  HomeSmileIcon as HomeSmileActiveIcon,
  UserRoundedIcon as UserRoundedActiveIcon,
} from "@solar-icons/react/line-duotone";

/** Keys of `nav.*` in src/messages/*.json: the label is translated where the tab is rendered. */
export type NavKey = "overview" | "showtimes" | "appointments" | "cinemas" | "chat" | "profile";

export interface NavItem {
  href: string;
  key: NavKey;
  icon: SolarIcon;
  activeIcon: SolarIcon;
  /** Turned on in the sprint that delivers the feature; disabled tabs stay hidden. */
  enabled: boolean;
  /** Other places that belong to this tab (the tab stays lit there): Settings and Friends are opened from Profile. */
  alsoActive?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "overview", icon: HomeSmileIcon, activeIcon: HomeSmileActiveIcon, enabled: true },
  { href: "/showtimes", key: "showtimes", icon: ClapperboardPlayIcon, activeIcon: ClapperboardPlayActiveIcon, enabled: true },
  { href: "/appointments", key: "appointments", icon: CalendarMarkIcon, activeIcon: CalendarMarkActiveIcon, enabled: true },
  { href: "/cinemas", key: "cinemas", icon: Armchair2Icon, activeIcon: Armchair2ActiveIcon, enabled: true },
  { href: "/chat", key: "chat", icon: ChatRoundLikeIcon, activeIcon: ChatRoundLikeActiveIcon, enabled: false }, // Sprint 7
  { href: "/profile", key: "profile", icon: UserRoundedIcon, activeIcon: UserRoundedActiveIcon, enabled: true, alsoActive: ["/settings", "/friends"] },
];

export const ENABLED_NAV_ITEMS = NAV_ITEMS.filter((item) => item.enabled);

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
 * Root screens of the user app: the ones that show the app bar (logo and avatar). Every other screen is an inner screen with its own
 * back bar, so a second bar above it would only waste height.
 */
export function isUserTabRoot(pathname: string): boolean {
  return pathname === "/" || ENABLED_NAV_ITEMS.some((item) => item.href === pathname);
}
