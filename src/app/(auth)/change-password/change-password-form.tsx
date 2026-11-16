"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const INITIAL_STATE: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">Mật khẩu mới</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Nhập lại mật khẩu mới</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="h-11 text-base"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="h-11 w-full text-base">
        {isPending ? "Đang lưu..." : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}
