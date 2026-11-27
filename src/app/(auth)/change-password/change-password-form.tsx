"use client";

import { DangerCircleIcon, EyeClosedIcon, EyeIcon, LoaderIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/required-mark";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/user-constants";
import { changePasswordAction } from "./actions";

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  enterKeyHint: "next" | "done";
  minLength?: number;
  disabled?: boolean;
  showLabel: string;
  hideLabel: string;
}

function PasswordField({ id, name, label, value, onChange, autoComplete, enterKeyHint, minLength, disabled, showLabel, hideLabel }: PasswordFieldProps) {
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          minLength={minLength}
          disabled={disabled}
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
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);
    startTransition(async () => {
      const result = await changePasswordAction({}, formData).catch(() => null);
      if (!result) {
        setError(t("errors.network"));
        return;
      }
      if (!result.ok) {
        setError(result.error ?? t("errors.invalid"));
        return;
      }
      toast.success(t("saved"));
      router.replace(result.redirectTo ?? "/");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-field">
      <PasswordField
        id="currentPassword"
        name="currentPassword"
        label={t("currentLabel")}
        value={currentPassword}
        onChange={(v) => {
          setCurrentPassword(v);
          setError(null);
        }}
        autoComplete="current-password"
        enterKeyHint="next"
        disabled={isPending}
        showLabel={tLogin("showPassword")}
        hideLabel={tLogin("hidePassword")}
      />
      <PasswordField
        id="newPassword"
        name="newPassword"
        label={t("newLabel")}
        value={newPassword}
        onChange={(v) => {
          setNewPassword(v);
          setError(null);
        }}
        autoComplete="new-password"
        enterKeyHint="next"
        minLength={MIN_PASSWORD_LENGTH}
        disabled={isPending}
        showLabel={tLogin("showPassword")}
        hideLabel={tLogin("hidePassword")}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={t("confirmLabel")}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          setError(null);
        }}
        autoComplete="new-password"
        enterKeyHint="done"
        disabled={isPending}
        showLabel={tLogin("showPassword")}
        hideLabel={tLogin("hidePassword")}
      />

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-stack rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive"
        >
          <DangerCircleIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
          {error}
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
