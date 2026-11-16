import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { auth } from "@/auth";
import { getUserLocale } from "@/services/user.service";
import { LOCALE_COOKIE } from "./config";
import { resolveLocale } from "./resolve-locale";

/**
 * Per-request language and messages. No URL prefix. Order: the signed-in user's saved language
 * (chosen in Settings), then the cookie (remembers the last choice on this device, also before sign-in),
 * then the browser language, then Vietnamese.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerStore, session] = await Promise.all([cookies(), headers(), auth()]);
  const savedLocale = session?.user?.id ? await getUserLocale(session.user.id) : null;
  const locale = resolveLocale(
    savedLocale ?? cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Dates are always shown in Vietnam time, whatever the language.
    timeZone: "Asia/Ho_Chi_Minh",
  };
});
