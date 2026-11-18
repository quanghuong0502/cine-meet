"use client";

import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Platform = "ios" | "android" | "other";

/** "ios|installed" read from the browser; the server has no browser, so it reads "" and the card is not drawn until the page is live. */
function readEnvironment(): string {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const platform: Platform = ios ? "ios" : /android/i.test(ua) ? "android" : "other";
  return `${platform}|${window.matchMedia("(display-mode: standalone)").matches ? "installed" : "browser"}`;
}
const subscribeNothing = () => () => undefined;

/**
 * How to put the app on the home screen. iPhone and iPad have no install button or event, so the steps are written out;
 * once the app is installed (display mode standalone) the card disappears.
 */
export function InstallGuide() {
  const t = useTranslations("settings.install");
  const environment = useSyncExternalStore(subscribeNothing, readEnvironment, () => "");
  const [platform, mode] = environment.split("|") as [Platform | undefined, string | undefined];
  const state = platform ? { platform, installed: mode === "installed" } : null;

  if (!state || state.installed) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-item-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-item">
        <p className="type-secondary text-muted-foreground">{t("why")}</p>
        <ol className="flex list-decimal flex-col gap-stack pl-inset type-body">
          {state.platform === "ios" ? (
            <>
              <li>
                {t("ios.step1")} <Share className="inline size-icon-sm align-text-bottom" aria-label={t("ios.shareIcon")} />
              </li>
              <li>{t("ios.step2")}</li>
              <li>{t("ios.step3")}</li>
            </>
          ) : state.platform === "android" ? (
            <>
              <li>{t("android.step1")}</li>
              <li>
                <Download className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
                {t("android.step2")}
              </li>
            </>
          ) : (
            <li>{t("other.step1")}</li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}
