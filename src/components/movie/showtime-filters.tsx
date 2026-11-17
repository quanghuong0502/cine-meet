"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { FILTER_KEYS, type FilterKey, type FilterValues } from "@/lib/showtime/filters";
import { cn } from "@/lib/utils";


interface Option {
  value: string;
  label: string;
}

interface Props {
  date: string;
  values: FilterValues;
  options: Record<FilterKey, Option[]>;
}

/** Filters of the showtime list. Every choice is written to the URL at once (the list below follows), so a link keeps the filters. */
export function ShowtimeFilters({ date, values, options }: Props) {
  const t = useTranslations("showtimes.filters");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(values);
  const activeCount = FILTER_KEYS.filter((key) => current[key]).length;

  function choose(key: FilterKey, value: string | undefined) {
    const next = { ...current, [key]: value };
    setCurrent(next);
    const params = new URLSearchParams({ date });
    for (const k of FILTER_KEYS) if (next[k]) params.set(k, next[k] as string);
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  return (
    <section aria-label={t("title")} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Chip selected={open || activeCount > 0} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal className="size-4" aria-hidden />
          {activeCount > 0 ? t("titleCount", { count: activeCount }) : t("title")}
        </Chip>
        {activeCount > 0 ? (
          <Chip
            selected={false}
            onClick={() => {
              setCurrent({});
              startTransition(() => router.replace(`${pathname}?${new URLSearchParams({ date })}`, { scroll: false }));
            }}
          >
            {t("clear")}
          </Chip>
        ) : null}
      </div>

      <div className={cn("flex flex-col gap-4", !open && "hidden")}>
        {FILTER_KEYS.filter((key) => options[key].length > 0).map((key) => (
          <div key={key} role="group" aria-label={t(`labels.${key}`)} className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t(`labels.${key}`)}</span>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip selected={!current[key]} onClick={() => choose(key, undefined)}>
                {t("all")}
              </Chip>
              {options[key].map((option) => (
                <Chip key={option.value} selected={current[key] === option.value} onClick={() => choose(key, option.value)}>
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
