"use client";

import { KeyRound, UserRound } from "lucide-react";
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
  /** Sign-out form, rendered by the server so it can use a server action. */
  children: React.ReactNode;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? "?"];
  return letters.map((word) => word.charAt(0).toUpperCase()).join("");
}

/** Avatar button in the header; opens a bottom sheet with profile links and sign-out (works by touch, no hover). */
export function UserMenu({ name, identity, children }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-full"
          aria-label="Mở menu tài khoản"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {getInitials(name)}
          </span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{name}</DrawerTitle>
          <DrawerDescription>{identity ?? "Tài khoản của bạn"}</DrawerDescription>
        </DrawerHeader>
        <nav
          aria-label="Menu tài khoản"
          className="flex flex-col gap-1 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <DrawerClose asChild>
            <Button asChild variant="ghost" className="h-11 justify-start gap-2">
              <Link href="/profile">
                <UserRound aria-hidden />
                Hồ sơ
              </Link>
            </Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button asChild variant="ghost" className="h-11 justify-start gap-2">
              <Link href="/change-password">
                <KeyRound aria-hidden />
                Đổi mật khẩu
              </Link>
            </Button>
          </DrawerClose>
          {children}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
