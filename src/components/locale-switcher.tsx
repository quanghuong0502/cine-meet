"use client";

import { LoaderIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LOCALE_LABELS, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/** Two-option language toggle labelled VI and EN. Screen readers announce the full name ("Tiếng Việt", "English"). */
export function LocaleSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const t = useTranslations("locale");
  const [target, setTarget] = useState<Locale | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current || isPending) return;
    setTarget(locale);
    startTransition(async () => {
      try {
        // `setLocaleAction` already runs `revalidatePath("/", "layout")`, so no second `router.refresh()` is needed.
        await setLocaleAction(locale);
      } catch {
        setTarget(null);
        toast.error(t("error"));
      }
    });
  }

  const shown = isPending && target ? target : current;

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("inline-flex rounded-full border bg-background p-hair", className)}
    >
      {LOCALES.map((locale) => {
        const selected = locale === shown;
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
            {isPending && target === locale ? <LoaderIcon className="size-icon-sm motion-safe:animate-spin" aria-hidden /> : null}
            {LOCALE_LABELS[locale]}
          </Button>
        );
      })}
    </div>
  );
}
