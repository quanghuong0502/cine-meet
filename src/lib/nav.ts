import {
  CalendarHeart,
  Clapperboard,
  LayoutDashboard,
  MessageCircle,
  Popcorn,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Turned on in the sprint that delivers the feature; disabled tabs stay hidden. */
  enabled: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard, enabled: false }, // Sprint 6
  { href: "/showtimes", label: "Lịch chiếu", icon: Clapperboard, enabled: false }, // Sprint 3
  { href: "/appointments", label: "Lịch hẹn", icon: CalendarHeart, enabled: false }, // Sprint 4
  { href: "/cinemas", label: "Rạp", icon: Popcorn, enabled: false }, // Sprint 3
  { href: "/chat", label: "Chat", icon: MessageCircle, enabled: false }, // Sprint 7
];

export const ENABLED_NAV_ITEMS = NAV_ITEMS.filter((item) => item.enabled);
