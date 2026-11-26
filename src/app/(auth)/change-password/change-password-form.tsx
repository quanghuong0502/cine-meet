"use client";

import { DangerCircleIcon, EyeClosedIcon, EyeIcon, LoaderIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/required-mark";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/user-constants";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const INITIAL_STATE: ChangePasswordState = {};

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  enterKeyHint: "next" | "done";
  minLength?: number;
  showLabel: string;
  hideLabel: string;
}

function PasswordField({ id, name, label, autoComplete, enterKeyHint, minLength, showLabel, hideLabel }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-item">
      <Label htmlFor={id}>
        <span>
          {label}
          <RequiredMark />
        </span>
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          minLength={minLength}
          required
          className="h-control rounded-xl bg-background pr-control pl-inset type-body"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute top-1/2 right-hair size-target -translate-y-1/2 text-muted-foreground"
        >
          {visible ? <EyeClosedIcon aria-hidden /> : <EyeIcon aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations("auth.changePassword");
  const tLogin = useTranslations("auth.login");
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} noValidate className="flex flex-col gap-field">
      <PasswordField
        id="currentPassword"
        name="currentPassword"
        label={t("currentLabel")}
        autoComplete="current-password"
        enterKeyHint="next"
        showLabel={tLogin("showPassword")}
        hideLabel={tLogin("hidePassword")}
      />
      <PasswordField
        id="newPassword"
        name="newPassword"
        label={t("newLabel")}
        autoComplete="new-password"
        enterKeyHint="next"
        minLength={MIN_PASSWORD_LENGTH}
        showLabel={tLogin("showPassword")}
        hideLabel={tLogin("hidePassword")}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={t("confirmLabel")}
        autoComplete="new-password"
        enterKeyHint="done"
        showLabel={tLogin("showPassword")}
        hideLabel={tLogin("hidePassword")}
      />

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-stack rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive"
        >
          <DangerCircleIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="cta" disabled={isPending}>
        {isPending ? (
          <>
            <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
            {t("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </Button>
    </form>
  );
}
