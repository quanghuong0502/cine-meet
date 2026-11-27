"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { POST_LOGIN_PATH } from "@/lib/post-login";
import { MIN_PASSWORD_LENGTH } from "@/lib/user-constants";
import { changePassword } from "@/services/user.service";

export interface ChangePasswordState {
  ok?: boolean;
  redirectTo?: string;
  error?: string;
}

const REASON_KEYS = {
  wrong_current: "wrongCurrent",
  same_password: "samePassword",
  too_short: "tooShort",
  no_password: "noPassword",
} as const;

export async function changePasswordAction(
  _previousState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  // userId comes from the session on the server, never from the form.
  const user = await requireUser({ allowPasswordChange: true });
  const t = await getTranslations("auth.changePassword.errors");

  const schema = z
    .object({
      currentPassword: z.string().min(1, t("currentRequired")),
      newPassword: z.string().min(MIN_PASSWORD_LENGTH, t("tooShort", { min: MIN_PASSWORD_LENGTH })),
      confirmPassword: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      path: ["confirmPassword"],
      error: t("mismatch"),
    });

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalid") };
  }

  const result = await changePassword(
    user.userId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) {
    const key = REASON_KEYS[result.reason];
    return { error: key === "tooShort" ? t(key, { min: MIN_PASSWORD_LENGTH }) : t(key) };
  }

  const redirectTo = user.mustChangePassword
    ? POST_LOGIN_PATH
    : user.role === "admin"
      ? "/admin/settings"
      : "/settings";
  return { ok: true, redirectTo };
}
