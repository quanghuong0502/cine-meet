import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * Minimal i18n namespaces needed by root/shell client components (`LoadingState`, `NetworkWatcher`,
 * `UserBottomNav`, `BackButton`, `UserMenu`, `SignOutButton`, `LocaleSwitcher`, `ConfirmDialog`, `Mascot`).
 * Keeps root RSC payload ~1.5 KB instead of serializing the entire 65.7 KB dictionary (41% of which is `admin`).
 */
export const ROOT_CLIENT_NAMESPACES = [
  "states",
  "mascot",
  "account",
  "nav",
  "locale",
  "confirmDialog",
] as const;

export function pickMessages(
  source: Record<string, unknown>,
  paths: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const parts = path.split(".");
    let src: unknown = source;
    for (const part of parts) {
      if (src && typeof src === "object" && part in src) {
        src = (src as Record<string, unknown>)[part];
      } else {
        src = undefined;
        break;
      }
    }
    if (src === undefined) continue;
    let dst = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!dst[part] || typeof dst[part] !== "object") dst[part] = {};
      dst = dst[part] as Record<string, unknown>;
    }
    dst[parts[parts.length - 1]!] = src;
  }
  return out;
}

/**
 * Provides route-scoped i18n namespaces to client components underneath.
 * Because `use-intl` v4 replaces rather than merges nested provider messages, this always includes
 * `ROOT_CLIENT_NAMESPACES` alongside the requested route `namespaces`.
 */
export async function ScopedIntlProvider({
  namespaces,
  children,
}: {
  namespaces: readonly string[];
  children: ReactNode;
}) {
  const messages = (await getMessages()) as Record<string, unknown>;
  const scoped = pickMessages(messages, [...ROOT_CLIENT_NAMESPACES, ...namespaces]);
  return <NextIntlClientProvider messages={scoped}>{children}</NextIntlClientProvider>;
}
