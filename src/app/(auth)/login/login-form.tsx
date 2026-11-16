"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithGoogle, loginWithPassword, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = {};

interface LoginFormProps {
  callbackUrl: string;
  initialError?: string;
}

export function LoginForm({ callbackUrl, initialError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    loginWithPassword,
    INITIAL_STATE,
  );
  const errorMessage = state.error ?? initialError;

  return (
    <div className="flex flex-col gap-6">
      <form action={loginWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button type="submit" variant="outline" className="h-11 w-full text-base">
          Tiếp tục với Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        hoặc dùng mật khẩu
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">Tên đăng nhập hoặc email</Label>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className="h-11 text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11 text-base"
          />
        </div>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending} className="h-11 w-full text-base">
          {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
    </div>
  );
}
