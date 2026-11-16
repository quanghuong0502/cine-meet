"use server";

import { getTranslations } from "next-intl/server";
import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";
import { ACCOUNT_LOCKED_CODE, signIn, TOO_MANY_ATTEMPTS_CODE } from "@/auth";
import { getSafeRedirectPath } from "@/lib/redirect";

export interface LoginState {
  error?: string;
}

const DEFAULT_LOCK_MINUTES = 15;

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

function readRedirectTarget(formData: FormData): string {
  const value = formData.get("callbackUrl");
  return getSafeRedirectPath(typeof value === "string" ? value : null);
}

export async function loginWithPassword(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getTranslations("auth.login.errors");

  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: t("invalidInput") };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: readRedirectTarget(formData),
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === ACCOUNT_LOCKED_CODE) return { error: t("accountLocked") };
      if (error.code.startsWith(`${TOO_MANY_ATTEMPTS_CODE}:`)) {
        const minutes = Number(error.code.split(":")[1]);
        return {
          error: t("tooManyAttempts", {
            minutes: Number.isFinite(minutes) ? minutes : DEFAULT_LOCK_MINUTES,
          }),
        };
      }
      return { error: t("invalidCredentials") };
    }
    if (error instanceof AuthError) return { error: t("fallback") };
    // Successful sign-in throws a redirect, which Next must receive untouched.
    throw error;
  }
  return {};
}

export async function loginWithGoogle(formData: FormData): Promise<void> {
  await signIn("google", { redirectTo: readRedirectTarget(formData) });
}
