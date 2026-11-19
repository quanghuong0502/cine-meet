"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/required-mark";
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
    <form action={formAction} className="flex flex-col gap-field">
      <div className="flex flex-col gap-item">
        <Label htmlFor="currentPassword"><span>{t("currentLabel")}<RequiredMark /></span></Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          enterKeyHint="next"
          required
          className="h-control rounded-xl bg-card px-inset type-body"
        />
      </div>
      <div className="flex flex-col gap-item">
        <Label htmlFor="newPassword"><span>{t("newLabel")}<RequiredMark /></span></Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          enterKeyHint="next"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className="h-control rounded-xl bg-card px-inset type-body"
        />
      </div>
      <div className="flex flex-col gap-item">
        <Label htmlFor="confirmPassword"><span>{t("confirmLabel")}<RequiredMark /></span></Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          enterKeyHint="done"
          required
          className="h-control rounded-xl bg-card px-inset type-body"
        />
      </div>

      {state.error ? (
        <p role="alert" className="type-secondary text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="cta" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
