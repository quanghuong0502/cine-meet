/** Supported UI languages. Edge-safe: no framework imports (docs: .claude/rules/i18n.md). */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "locale";

/** Short label shown on the language switch. */
export const LOCALE_LABELS: Record<Locale, string> = {
  vi: "VI",
  en: "EN",
};

/** Full name of each language in that language: the accessible name of its switch button, readable whatever language is active. */
export const LOCALE_NAMES: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}
