"use client";

import { CloseIcon, Tuning2Icon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { LazyFilterDrawer } from "@/components/filter-drawer";
import { Button } from "@/components/ui/button";
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
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [optimistic, setOptimistic] = useState<{ key: string; values: FilterValues } | null>(null);
  const [draft, setDraft] = useState(values);
  const anchor = useRef<HTMLDivElement>(null);
  // True once the filter button at the top has scrolled out of the screen: the floating button then takes its place.
  const [floating, setFloating] = useState(false);
  const valuesKey = FILTER_KEYS.map((k) => values[k] ?? "").join("|");
  const applied = optimistic && optimistic.key === valuesKey ? optimistic.values : values;

  const activeKeys = FILTER_KEYS.filter((key) => applied[key]);
  const draftHasAny = FILTER_KEYS.some((key) => Boolean(draft[key]));
  const { groups, offeredMap, matchCount } = useMemo(() => {
    const source = open ? draft : applied;
    const avail = availableValues(records, source);
    const map = {} as Record<FilterKey, string[]>;
    for (const key of FILTER_KEYS) {
      map[key] = FILTER_CHOICES[key].filter((value) => avail[key].has(value) || source[key] === value);
    }
    const visibleGroups = FILTER_KEYS.filter((key) => map[key].length >= 2 || source[key]);
    return {
      groups: visibleGroups,
      offeredMap: map,
      matchCount: open ? applyFilters(records, draft).length : 0,
    };
  }, [records, open, draft, applied]);
  const labelOf = (key: FilterKey, value: string) =>
    t(`options.${key}.${value}` as Parameters<typeof t>[0]);

  function apply(next: FilterValues) {
    setOptimistic({ key: valuesKey, values: next });
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
    if (next) {
      setDrawerMounted(true);
      setDraft(applied);
    }
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
    <section aria-label={t("title")} aria-busy={isPending} className="flex flex-col gap-stack">
      <div ref={anchor} className="flex items-center justify-between gap-stack">
        {canFilter ? (
          <Chip
            selected={activeKeys.length > 0}
            onClick={() => onOpenChange(true)}
            aria-haspopup="dialog"
          >
            <Tuning2Icon className="size-icon-sm shrink-0" aria-hidden />
            <span className="truncate">{buttonLabel}</span>
          </Chip>
        ) : (
          <span />
        )}
        {action}
      </div>
      {canFilter && floating ? (
        <div
          data-bottom-fixed
          className="pointer-events-none fixed inset-x-0 bottom-[var(--nav-clearance)] z-30"
        >
          <div className="mx-auto flex max-w-app justify-center px-inset">
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(true)}
              aria-haspopup="dialog"
              className="pointer-events-auto rounded-full px-inset shadow-lg"
            >
              <Tuning2Icon className="size-icon-sm" aria-hidden />
              {buttonLabel}
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
                className="border-transparent bg-accent text-accent-foreground"
              >
                <span className="min-w-0 truncate">{name}</span>
                <CloseIcon className="size-icon-sm shrink-0" aria-hidden />
              </Chip>
            );
          })}
        </div>
      ) : null}

      {drawerMounted ? (
        <LazyFilterDrawer
          open={open}
          onOpenChange={onOpenChange}
          title={t("title")}
          footer={
            <>
              <Button
                type="button"
                size="cta"
                disabled={matchCount === 0}
                onClick={() => {
                  apply(draft);
                  setOpen(false);
                }}
              >
                {t("show", { count: matchCount })}
              </Button>
              {draftHasAny || activeKeys.length > 0 ? (
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
              ) : null}
            </>
          }
        >
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
                  <span className="truncate">{t("all")}</span>
                </Chip>
                {offeredMap[key].map((value) => (
                  <Chip
                    key={value}
                    selected={draft[key] === value}
                    onClick={() => setDraft({ ...draft, [key]: value })}
                  >
                    <span className="min-w-0 truncate">{labelOf(key, value)}</span>
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </LazyFilterDrawer>
      ) : null}
    </section>
  );
}
