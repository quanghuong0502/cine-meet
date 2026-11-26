"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states.error");
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        mascot="bubu-sleepy"
        title={t("title")}
        description={t("description")}
        action={
          <Button onClick={reset} size="pill">
            {t("retry")}
          </Button>
        }
      />
    </main>
  );
}
