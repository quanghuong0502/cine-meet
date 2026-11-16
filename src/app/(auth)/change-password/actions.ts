"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { changePassword, MIN_PASSWORD_LENGTH } from "@/services/user.service";

export interface ChangePasswordState {
  error?: string;
}

const schema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    error: "Mật khẩu nhập lại không khớp.",
  });

const REASON_MESSAGES = {
  wrong_current: "Mật khẩu hiện tại không đúng.",
  same_password: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  too_short: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
  no_password: "Tài khoản này đăng nhập bằng Google, không có mật khẩu để đổi.",
} as const;

export async function changePasswordAction(
  _previousState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  // userId comes from the session on the server, never from the form.
  const user = await requireUser({ allowPasswordChange: true });

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const result = await changePassword(
    user.userId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) return { error: REASON_MESSAGES[result.reason] };

  redirect("/");
}
