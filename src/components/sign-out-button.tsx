"use client";

import { Logout2Icon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { signOutAction } from "@/actions/sign-out";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("account");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(() => signOutAction());
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn(
          "min-h-row w-full justify-start gap-item text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15",
          className,
        )}
      >
        <IconBadge tone="destructive">
          <Logout2Icon />
        </IconBadge>
        {t("signOut")}
      </Button>
      {open ? (
        <LazyConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={t("signOutTitle")}
          description={t("signOutDescription")}
          tone="destructive"
          icon={<Logout2Icon aria-hidden />}
          confirmLabel={t("signOut")}
          pending={pending}
          onConfirm={confirm}
        />
      ) : null}
    </>
  );
}
