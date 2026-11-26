"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

const UPDATE_TOAST_ID = "sw-update";
/** Minimum interval between background update checks when returning to an installed PWA. */
const UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * Registers `/sw.js` once the page finishes loading, checks for updates when returning to the app,
 * and shows a non-disruptive prompt before sending `SKIP_WAITING` so active sessions never hit
 * mid-session chunk mismatches after a deployment.
 */
export function ServiceWorkerRegister() {
  const t = useTranslations("states.update");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloading = false;
    let lastCheckedAt = Date.now();
    let disposed = false;

    const promptUpdate = (worker: ServiceWorker) => {
      if (disposed) return;
      toast(t("available"), {
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        action: {
          label: t("action"),
          onClick: () => {
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    const watchInstalling = (worker: ServiceWorker) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          promptUpdate(worker);
        }
      });
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (installing) watchInstalling(installing);
    };

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !registration || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheckedAt = now;
      registration.update().catch(() => undefined);
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (disposed) return;
          registration = reg;
          if (reg.waiting && navigator.serviceWorker.controller) {
            promptUpdate(reg.waiting);
          }
          if (reg.installing) {
            watchInstalling(reg.installing);
          }
          reg.addEventListener("updatefound", onUpdateFound);
        })
        .catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, [t]);

  return null;
}
