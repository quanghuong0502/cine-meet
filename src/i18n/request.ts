import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getActiveUser } from "@/lib/auth/guards";
import { applyPronouns } from "@/lib/pronouns";
import { getPronounsCached } from "@/services/pronouns-cache";
import { LOCALE_COOKIE } from "./config";
import { resolveLocale } from "./resolve-locale";

/**
 * Per-request language and messages. No URL prefix. Order: the signed-in user's saved language
 * (chosen in Settings), then the cookie (remembers the last choice on this device, also before sign-in),
 * then the browser language, then Vietnamese.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerStore, user] = await Promise.all([cookies(), headers(), getActiveUser()]);
  // Same read the layout's guard uses, so the user is loaded once per request (a locked or removed user falls back to the cookie).
  const savedLocale = user?.locale ?? null;
  const locale = resolveLocale(
    savedLocale ?? cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );

  const messages = (await import(`../messages/${locale}.json`)).default;
  // Vietnamese messages hold pronoun tokens; the admin's pair (default bạn / tôi) is put in here, once per pair, not per request.
  const spoken = locale === "vi" ? applyPronouns(messages, await getPronounsCached()) : messages;

  return {
    locale,
    messages: spoken,
    // Dates are always shown in Vietnam time, whatever the language.
    timeZone: "Asia/Ho_Chi_Minh",
  };
});
