"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { GoogleIcon } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/required-mark";
import { Label } from "@/components/ui/label";
import { loginWithGoogle, loginWithPassword, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = {};

interface LoginFormProps {
  callbackUrl: string;
  initialError?: string;
}

function GoogleButton() {
  const t = useTranslations("auth.login");
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="cta"
      disabled={pending}
      className="gap-item bg-card"
    >
      {pending ? (
        <LoaderCircle className="size-icon motion-safe:animate-spin" aria-hidden />
      ) : (
        <GoogleIcon className="size-icon" />
      )}
      {t("google")}
    </Button>
  );
}

export function LoginForm({ callbackUrl, initialError }: LoginFormProps) {
  const t = useTranslations("auth.login");
  const [state, formAction, isPending] = useActionState(
    loginWithPassword,
    INITIAL_STATE,
  );
  const [showPassword, setShowPassword] = useState(false);
  const errorMessage = state.error ?? initialError;

  return (
    <div className="flex flex-col gap-group">
      <form action={formAction} className="flex flex-col gap-field">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div className="flex flex-col gap-item">
          <Label htmlFor="identifier" className="text-muted-foreground">
            <span>
              {t("identifierLabel")}
              <RequiredMark />
            </span>
          </Label>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            enterKeyHint="next"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className="h-control rounded-xl bg-card px-inset type-body"
          />
        </div>

        <div className="flex flex-col gap-item">
          <Label htmlFor="password" className="text-muted-foreground">
            <span>
              {t("passwordLabel")}
              <RequiredMark />
            </span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="go"
              required
              className="h-control rounded-xl bg-card pr-control pl-inset type-body"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-0.5 size-target -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="flex items-start gap-stack rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive"
          >
            <CircleAlert className="mt-hair size-icon-sm shrink-0" aria-hidden />
            {errorMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          size="cta"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
              {t("submitting")}
            </>
          ) : (
            t("submit")
          )}
        </Button>
      </form>

      <div className="flex items-center gap-group type-secondary text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={loginWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <GoogleButton />
      </form>

      <p className="text-center type-micro text-muted-foreground">
        {t.rich("help", {
          highlight: (chunks) => <span className="text-primary-text">{chunks}</span>,
        })}
      </p>
    </div>
  );
}
