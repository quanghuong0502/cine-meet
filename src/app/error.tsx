"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { AppOpenedMarker } from "@/components/route-loading";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states.error");
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <AppOpenedMarker />
      <EmptyState
        mascot="bubu-sleepy"
        title={t("title")}
        description={t("description")}
        action={
          <Button onClick={reset} className="h-control rounded-full px-8 text-base">
            {t("retry")}
          </Button>
        }
      />
    </main>
  );
}
