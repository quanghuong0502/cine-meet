"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { setUserLocale } from "@/services/user.service";
import { isLocale, LOCALE_COOKIE } from "./config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Saves the chosen language in a cookie and, when signed in, on the account (`users.locale`). */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });

  // userId comes from the session, never from the caller.
  const session = await auth();
  if (session?.user?.id) await setUserLocale(session.user.id, locale);

  revalidatePath("/", "layout");
}
