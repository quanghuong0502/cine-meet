"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/user-constants";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const INITIAL_STATE: ChangePasswordState = {};

export function ChangePasswordForm() {
  const t = useTranslations("auth.changePassword");
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">{t("currentLabel")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-xl bg-card px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">{t("newLabel")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby="newPasswordHint"
          required
          className="h-12 rounded-xl bg-card px-4 text-base"
        />
        <p id="newPasswordHint" className="text-xs text-muted-foreground">
          {t("newHint", { min: MIN_PASSWORD_LENGTH })}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t("confirmLabel")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="h-12 rounded-xl bg-card px-4 text-base"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="h-12 w-full rounded-full text-base font-semibold">
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
