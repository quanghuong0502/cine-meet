"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Keeps the user shell (header + bottom nav) mounted on errors so PWA users are never trapped without navigation. */
export default function UserErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states.error");
  const notFound = useTranslations("states.notFound");
  return (
    <div className="flex flex-1 items-center justify-center p-inset">
      <EmptyState
        mascot="bubu-sleepy"
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-stack">
            <Button onClick={reset} size="pill">
              {t("retry")}
            </Button>
            <Button asChild variant="outline" size="pill">
              <Link href="/">{notFound("action")}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
