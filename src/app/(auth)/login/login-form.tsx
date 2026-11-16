"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { GoogleIcon } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      disabled={pending}
      className="h-12 w-full gap-3 rounded-full bg-card text-base font-medium"
    >
      {pending ? (
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
      ) : (
        <GoogleIcon className="size-5" />
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
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier" className="text-muted-foreground">
            {t("identifierLabel")}
          </Label>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className="h-12 rounded-xl bg-card px-4 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-muted-foreground">
            {t("passwordLabel")}
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="h-12 rounded-xl bg-card pr-12 pl-4 text-base"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-0.5 size-11 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errorMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="h-12 w-full rounded-full text-base font-semibold"
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

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={loginWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <GoogleButton />
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {t.rich("help", {
          highlight: (chunks) => <span className="text-primary-text">{chunks}</span>,
        })}
      </p>
    </div>
  );
}
