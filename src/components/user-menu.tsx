"use client";

import { Settings } from "lucide-react";
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
  /** Which area the avatar sits in. Users: it opens the Profile page. Admins have no profile, so theirs opens a menu. */
  area?: "app" | "admin";
  /** Admin menu only: the sign-out form, rendered by the server so it can use a server action. */
  children?: React.ReactNode;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? "?"];
  return letters.map((word) => word.charAt(0).toUpperCase()).join("");
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-avatar items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {getInitials(name)}
    </span>
  );
}

/** Avatar button in the header; opens a bottom sheet with profile links and sign-out (works by touch, no hover). */
export function UserMenu({ name, identity, area = "app", children }: UserMenuProps) {
  const t = useTranslations("account");
  const [open, setOpen] = useState(false);

  if (area === "app") {
    return (
      <Button asChild variant="ghost" size="icon" className="size-target rounded-full">
        <Link href="/profile" aria-label={t("profile")}>
          <Avatar name={name} />
        </Link>
      </Button>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-target rounded-full"
          aria-label={t("openMenu")}
        >
          <Avatar name={name} />
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
          {/* Everything about the account (language, password...) lives in Settings. */}
          <DrawerClose asChild>
            <Button asChild variant="ghost" className="h-target justify-start gap-2">
              <Link href="/admin/settings">
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
