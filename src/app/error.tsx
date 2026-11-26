"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states.error");
  const notFound = useTranslations("states.notFound");
  return (
    <main className="flex min-h-dvh items-center justify-center px-inset pt-(--inset-top) pb-(--inset-bottom)">
      <EmptyState
        mascot="bubu-sleepy"
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-stack">
            <Button type="button" onClick={reset} size="pill">
              {t("retry")}
            </Button>
            <Button asChild variant="outline" size="pill">
              <Link href="/">{notFound("action")}</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
