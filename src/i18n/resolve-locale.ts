import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

/** Picks the first supported language from an Accept-Language header, honoring q-values. */
function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  const candidates = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { primary: tag.trim().toLowerCase().split("-")[0] ?? "", weight };
    })
    .filter((c) => c.primary && Number.isFinite(c.weight) && c.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { primary } of candidates) {
    const match = LOCALES.find((locale) => locale === primary);
    if (match) return match;
  }
  return null;
}

/** Language for a request: the saved cookie first, then the browser's preference, then Vietnamese. */
export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
