"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LOCALE_LABELS, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/** Two-option language toggle labelled VI and EN. Screen readers announce the full name ("Tiếng Việt", "English"). */
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
      className={cn("inline-flex rounded-full border bg-card p-hair", className)}
    >
      {LOCALES.map((locale) => {
        const selected = locale === current;
        return (
          <Button
            key={locale}
            type="button"
            lang={locale}
            aria-label={LOCALE_NAMES[locale]}
            variant={selected ? "default" : "ghost"}
            aria-pressed={selected}
            disabled={isPending}
            onClick={() => choose(locale)}
            className={cn(
              "h-target min-w-control-lg rounded-full px-inset type-secondary font-semibold! tracking-wide",
              !selected && "text-muted-foreground",
            )}
          >
            {LOCALE_LABELS[locale]}
          </Button>
        );
      })}
    </div>
  );
}
