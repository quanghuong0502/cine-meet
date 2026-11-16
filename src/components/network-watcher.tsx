"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

const NETWORK_TOAST_ID = "network";
/** Away from the app for longer than this (screen off, another app): reload the data when coming back. */
const STALE_AFTER_MS = 60_000;

/**
 * Two things an installed phone app has to do by itself (docs: .claude/rules/pwa.md):
 * - say plainly when the connection drops or comes back, instead of failing silently;
 * - refresh what is on screen when the app returns to the foreground (there is no pull-to-refresh on iPhone).
 */
export function NetworkWatcher() {
  const t = useTranslations("states.network");
  const router = useRouter();

  useEffect(() => {
    const showOffline = () => toast.error(t("offline"), { id: NETWORK_TOAST_ID, duration: Infinity });
    const showOnline = () => toast.success(t("online"), { id: NETWORK_TOAST_ID, duration: 3000 });

    if (!navigator.onLine) showOffline();
    window.addEventListener("offline", showOffline);
    window.addEventListener("online", showOnline);

    let hiddenAt: number | null = null;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_MS && navigator.onLine) router.refresh();
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("offline", showOffline);
      window.removeEventListener("online", showOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, t]);

  return null;
}
