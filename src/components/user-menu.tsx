"use client";

import { Settings, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface UserMenuProps {
  name: string;
  /** Email or username, shown under the name. */
  identity?: string;
  /** Which area the menu sits in. Admins only have the admin area, so their menu has no profile page. */
  area?: "app" | "admin";
  /** Sign-out form, rendered by the server so it can use a server action. */
  children: React.ReactNode;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? "?"];
  return letters.map((word) => word.charAt(0).toUpperCase()).join("");
}

/** Avatar button in the header; opens a bottom sheet with profile links and sign-out (works by touch, no hover). */
export function UserMenu({ name, identity, area = "app", children }: UserMenuProps) {
  const t = useTranslations("account");
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-target rounded-full"
          aria-label={t("openMenu")}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {getInitials(name)}
          </span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{name}</DrawerTitle>
          <DrawerDescription>{identity ?? t("fallbackIdentity")}</DrawerDescription>
        </DrawerHeader>
        <nav
          aria-label={t("menuLabel")}
          className="flex flex-col gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          {area === "app" ? (
            <DrawerClose asChild>
              <Button asChild variant="ghost" className="h-target justify-start gap-2">
                <Link href="/profile">
                  <UserRound aria-hidden />
                  {t("profile")}
                </Link>
              </Button>
            </DrawerClose>
          ) : null}
          {/* Everything about the account (language, password...) lives in Settings. */}
          <DrawerClose asChild>
            <Button asChild variant="ghost" className="h-target justify-start gap-2">
              <Link href={area === "admin" ? "/admin/settings" : "/settings"}>
                <Settings aria-hidden />
                {t("settings")}
              </Link>
            </Button>
          </DrawerClose>
          {children}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
