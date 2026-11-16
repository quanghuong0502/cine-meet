"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";
import { ACCOUNT_LOCKED_CODE, signIn, TOO_MANY_ATTEMPTS_CODE } from "@/auth";
import { getSafeRedirectPath } from "@/lib/redirect";
import {
  ACCOUNT_LOCKED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_INPUT_MESSAGE,
  LOGIN_FALLBACK_ERROR,
  tooManyAttemptsMessage,
} from "./messages";

export interface LoginState {
  error?: string;
}

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
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: INVALID_INPUT_MESSAGE };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: readRedirectTarget(formData),
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === ACCOUNT_LOCKED_CODE) return { error: ACCOUNT_LOCKED_MESSAGE };
      if (error.code.startsWith(`${TOO_MANY_ATTEMPTS_CODE}:`)) {
        const minutes = Number(error.code.split(":")[1]);
        return { error: tooManyAttemptsMessage(Number.isFinite(minutes) ? minutes : 15) };
      }
      return { error: INVALID_CREDENTIALS_MESSAGE };
    }
    if (error instanceof AuthError) return { error: LOGIN_FALLBACK_ERROR };
    // Successful sign-in throws a redirect, which Next must receive untouched.
    throw error;
  }
  return {};
}

export async function loginWithGoogle(formData: FormData): Promise<void> {
  await signIn("google", { redirectTo: readRedirectTarget(formData) });
}
