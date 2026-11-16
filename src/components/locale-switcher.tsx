"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/** Two-option language toggle. Each language is shown by its own name so it is always readable. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("inline-flex rounded-full border bg-card p-0.5", className)}
    >
      {LOCALES.map((locale) => {
        const selected = locale === current;
        return (
          <Button
            key={locale}
            type="button"
            lang={locale}
            variant={selected ? "default" : "ghost"}
            aria-pressed={selected}
            disabled={isPending}
            onClick={() => choose(locale)}
            className={cn(
              "h-11 rounded-full px-4 text-sm font-medium",
              !selected && "text-muted-foreground",
            )}
          >
            {LOCALE_NAMES[locale]}
          </Button>
        );
      })}
    </div>
  );
}
