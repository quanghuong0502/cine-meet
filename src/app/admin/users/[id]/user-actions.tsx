"use client";

import { KeyRound, LoaderCircle, Lock, LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { setUserStatusAction } from "../actions";

interface UserActionsProps {
  id: string;
  name: string;
  locked: boolean;
  /** The admin looking at their own account: it cannot be locked from here. */
  isSelf: boolean;
  canResetPassword: boolean;
  resetHref: string;
}

/** Lock or unlock (asks first) and reset password (its own screen) for one account. */
export function UserActions({ id, name, locked, isSelf, canResetPassword, resetHref }: UserActionsProps) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await setUserStatusAction(id, locked ? "active" : "locked");
      setConfirming(false);
      if (result.ok) {
        toast.success(t(locked ? "unlocked" : "lockedToast"));
        router.refresh();
      } else {
        toast.error(tc(`errors.${result.error}`));
      }
    });
  }

  const canToggle = locked || !isSelf;
  if (!canToggle && !canResetPassword) return null;

  return (
    <div className="grid gap-2">
      {canResetPassword ? (
        <Button asChild variant="outline" size="cta-sm">
          <Link href={resetHref}>
            <KeyRound aria-hidden />
            {t("resetPassword")}
          </Link>
        </Button>
      ) : null}
      {canToggle ? (
        <Button type="button" variant={locked ? "outline" : "destructive"} size="cta-sm" onClick={() => setConfirming(true)}>
          {locked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
          {t(locked ? "unlock" : "lock")}
        </Button>
      ) : null}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(locked ? "unlockTitle" : "lockTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t(locked ? "unlockDescription" : "lockDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              {isPending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : null}
              {t(locked ? "unlock" : "lock")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
