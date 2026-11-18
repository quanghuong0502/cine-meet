"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { isAdminTabRoot } from "@/lib/admin-nav";
import { isUserTabRoot } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  area: "app" | "admin";
  name: string;
  image?: string;
}

/**
 * The app bar (logo and avatar). It shows only on a root screen; an inner screen has its own back bar (`PageHeader`), and
 * two bars stacked would take about 56px of a phone screen for nothing. On desktop admin the sidebar replaces it (`md:hidden`).
 */
export function AppHeader({ area, name, image }: AppHeaderProps) {
  const pathname = usePathname();
  const isRoot = area === "admin" ? isAdminTabRoot(pathname) : isUserTabRoot(pathname);
  if (!isRoot) return null;

  return (
    <header
      className={cn(
        "z-30 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-1",
        area === "admin" && "bg-background/95 backdrop-blur md:hidden",
      )}
    >
      <Logo size={area === "admin" ? 44 : 48} wordmarkClassName="type-heading" />
      <UserMenu area={area} name={name} image={image} />
    </header>
  );
}
