"use client";

import { Logout2Icon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
    start(async () => {
      try {
        await signOutAction();
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err && String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        setOpen(false);
        toast.error(t("networkError"));
      }
    });
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
