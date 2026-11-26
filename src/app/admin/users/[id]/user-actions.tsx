"use client";

import { KeyIcon, LockKeyholeIcon, LockKeyholeUnlockedIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
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
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await setUserStatusAction(id, locked ? "active" : "locked");
      setConfirming(false);
      if (result.ok) {
        toast.success(t(locked ? "unlocked" : "lockedToast"));
      } else {
        toast.error(tc(`errors.${result.error}`));
      }
    });
  }

  const canToggle = locked || !isSelf;
  if (!canToggle && !canResetPassword) return null;

  return (
    <div className="grid gap-stack">
      {canResetPassword ? (
        <Button asChild variant="outline" size="cta-sm">
          <Link href={resetHref}>
            <KeyIcon aria-hidden />
            {t("resetPassword")}
          </Link>
        </Button>
      ) : null}
      {canToggle ? (
        <Button type="button" variant={locked ? "outline" : "destructive"} size="cta-sm" onClick={() => setConfirming(true)}>
          {locked ? <LockKeyholeUnlockedIcon aria-hidden /> : <LockKeyholeIcon aria-hidden />}
          {t(locked ? "unlock" : "lock")}
        </Button>
      ) : null}

      {confirming ? (
        <LazyConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t(locked ? "unlockTitle" : "lockTitle", { name })}
          description={t(locked ? "unlockDescription" : "lockDescription")}
          tone={locked ? "default" : "destructive"}
          confirmLabel={t(locked ? "unlock" : "lock")}
          pending={isPending}
          onConfirm={confirm}
        />
      ) : null}
    </div>
  );
}
