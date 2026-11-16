import type { Locale } from "@/i18n/config";
import type vi from "../messages/vi.json";

// Makes `t("some.key")` type-checked against the Vietnamese messages (the reference language).
// A test keeps the English file's keys identical.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof vi;
  }
}
