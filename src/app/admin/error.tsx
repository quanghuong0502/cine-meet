"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Keeps the admin shell mounted on errors so standalone PWA admins always have a working escape route. */
export default function AdminErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states.error");
  const nav = useTranslations("admin.nav");
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
              <Link href="/admin">{nav("overview")}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
