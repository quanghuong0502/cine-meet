"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  applyFilters,
  availableValues,
  FILTER_CHOICES,
  FILTER_KEYS,
  type FacetRecord,
  type FilterKey,
  type FilterValues,
} from "@/lib/appointment/filters";

interface Props {
  /** The create button: shares the row with the filter chip. */
  action?: React.ReactNode;
  values: FilterValues;
  /** Every appointment of the list, as the filters see them: the sheet narrows its choices and counts results from these. */
  records: FacetRecord[];
}

/** Filters of the appointment list: same sheet, chips and floating button as the showtime filters (`ShowtimeFilters`). */
export function AppointmentFilters({ values, records, action }: Props) {
  const t = useTranslations("appointments.filters");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(values);
  const [draft, setDraft] = useState(values);
  const anchor = useRef<HTMLDivElement>(null);
  // True once the filter button at the top has scrolled out of the screen: the floating button then takes its place.
  const [floating, setFloating] = useState(false);

  const activeKeys = FILTER_KEYS.filter((key) => applied[key]);
  const available = availableValues(records, draft);
  // Only choices that still leave an appointment (given the other group's choice) are offered; the one in force stays, so it can be undone.
  const offered = (key: FilterKey) =>
    FILTER_CHOICES[key].filter(
      (value) => available[key].has(value) || draft[key] === value,
    );
  // A group with fewer than two choices left has nothing to choose, unless one is in force.
  const groups = FILTER_KEYS.filter(
    (key) => offered(key).length >= 2 || draft[key],
  );
  const labelOf = (key: FilterKey, value: string) =>
    t(`options.${key}.${value}` as Parameters<typeof t>[0]);

  function apply(next: FilterValues) {
    setApplied(next);
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS)
      if (next[key]) params.set(key, next[key] as string);
    startTransition(() =>
      router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, {
        scroll: false,
      }),
    );
  }

  function onOpenChange(next: boolean) {
    if (next) setDraft(applied);
    setOpen(next);
  }

  const canFilter = groups.length > 0 || activeKeys.length > 0;

  useEffect(() => {
    const element = anchor.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setFloating(!entry?.isIntersecting),
      { root: element.closest("[data-app-scroll]") },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      setFloating(false);
    };
  }, [canFilter]);

  const buttonLabel =
    activeKeys.length > 0
      ? t("titleCount", { count: activeKeys.length })
      : t("title");

  return (
    <section aria-label={t("title")} className="flex flex-col gap-stack">
      <div ref={anchor} className="flex items-center justify-between gap-stack">
        {canFilter ? (
          <Chip
            selected={activeKeys.length > 0}
            onClick={() => onOpenChange(true)}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal className="size-icon-sm" aria-hidden />
            {buttonLabel}
          </Chip>
        ) : (
          <span />
        )}
        {action}
      </div>
      {/* Once the button above has scrolled away it floats at the bottom right, above the menu, as the icon alone, with a small count badge when filters are on (the label and count are also in aria-label). */}
      {canFilter && floating ? (
        <div
          data-bottom-fixed
          className="pointer-events-none fixed inset-x-0 bottom-[var(--nav-clearance)] z-30"
        >
          <div className="mx-auto flex max-w-app justify-end px-inset">
            <Button
              type="button"
              size="icon"
              onClick={() => onOpenChange(true)}
              aria-haspopup="dialog"
              aria-label={buttonLabel}
              className="pointer-events-auto relative rounded-full shadow-lg"
            >
              <SlidersHorizontal className="size-icon" aria-hidden />
              {activeKeys.length > 0 ? (
                <span
                  aria-hidden
                  className="absolute -top-tight -right-tight flex size-icon items-center justify-center rounded-full bg-foreground type-tag font-semibold! text-background tabular-nums"
                >
                  {activeKeys.length}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      ) : null}
      {activeKeys.length > 0 ? (
        <div className="scroll-strip flex items-center gap-stack">
          {activeKeys.map((key) => {
            const name = labelOf(key, applied[key] as string);
            return (
              <Chip
                key={key}
                selected={false}
                onClick={() => apply({ ...applied, [key]: undefined })}
                aria-label={t("remove", { name })}
              >
                {name}
                <X className="size-icon-sm" aria-hidden />
              </Chip>
            );
          })}
        </div>
      ) : null}

      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent aria-describedby={undefined}>
          <DrawerHeader>
            <DrawerTitle className="type-heading">{t("title")}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-col gap-group overflow-y-auto overscroll-contain px-inset pb-inset">
            {groups.map((key) => (
              <div
                key={key}
                role="group"
                aria-label={t(`labels.${key}`)}
                className="flex flex-col gap-stack"
              >
                <span className="type-secondary text-muted-foreground">
                  {t(`labels.${key}`)}
                </span>
                <div className="flex flex-wrap gap-stack">
                  <Chip
                    selected={!draft[key]}
                    onClick={() => setDraft({ ...draft, [key]: undefined })}
                  >
                    {t("all")}
                  </Chip>
                  {offered(key).map((value) => (
                    <Chip
                      key={value}
                      selected={draft[key] === value}
                      onClick={() => setDraft({ ...draft, [key]: value })}
                    >
                      {labelOf(key, value)}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DrawerFooter className="pb-(--inset-bottom)">
            <Button
              type="button"
              size="cta"
              onClick={() => {
                apply(draft);
                setOpen(false);
              }}
            >
              {t("show", { count: applyFilters(records, draft).length })}
            </Button>
            <Button
              type="button"
              size="cta-sm"
              variant="ghost"
              onClick={() => {
                // Clearing is applied at once and closes the sheet: nothing is left to review.
                setDraft({});
                apply({});
                setOpen(false);
              }}
            >
              {t("clear")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
