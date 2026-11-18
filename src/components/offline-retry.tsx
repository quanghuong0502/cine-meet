"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Reloads the page the person was trying to reach; the offline page only appears when that load failed. */
export function OfflineRetry() {
  const t = useTranslations("offline");
  return (
    <Button type="button" size="pill" onClick={() => window.location.reload()}>
      <RefreshCw aria-hidden />
      {t("retry")}
    </Button>
  );
}
