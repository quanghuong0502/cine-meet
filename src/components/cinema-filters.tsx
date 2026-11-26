"use client";

import { CloseIcon, Tuning2Icon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { LazyFilterDrawer } from "@/components/filter-drawer";
import { Button } from "@/components/ui/button";
import { availableCinemaValues, CINEMA_FILTER_KEYS as FILTER_KEYS, countCinemas, type CinemaFacet, type CinemaFilterKey as FilterKey, type CinemaFilterValues as FilterValues } from "@/lib/cinema/filters";

interface Option {
  value: string;
  label: string;
}

interface Props {
  values: FilterValues;
  options: Record<FilterKey, Option[]>;
  /** The branches, as the filters see them: the sheet narrows its choices and counts results from these. */
  records: CinemaFacet[];
}

/**
 * Filters of the cinema list: same behaviour and look as the showtime filters (`ShowtimeFilters`): a bottom sheet with a draft, chips for
 * what is in force, a floating button once the top one scrolls away, and only choices that still lead to a branch.
 */
export function CinemaFilters({ values, options, records }: Props) {
  const t = useTranslations("cinemas.filters");
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
  const appliedCount = useMemo(() => countCinemas(records, applied), [records, applied]);
  const { groups, offeredMap, draftCount } = useMemo(() => {
    const source = open ? draft : applied;
    const avail = availableCinemaValues(records, source);
    const map = {} as Record<FilterKey, Option[]>;
    for (const key of FILTER_KEYS) {
      map[key] = options[key].filter((option) => avail[key].has(option.value) || source[key] === option.value);
    }
    const visibleGroups = FILTER_KEYS.filter((key) => map[key].length >= (key === "frequent" ? 1 : 2) || source[key]);
    return {
      groups: visibleGroups,
      offeredMap: map,
      draftCount: open ? countCinemas(records, draft) : appliedCount,
    };
  }, [records, options, open, draft, applied, appliedCount]);
  const labelOf = (key: FilterKey, value: string) => options[key].find((option) => option.value === value)?.label ?? value;

  function apply(next: FilterValues) {
    setOptimistic({ key: valuesKey, values: next });
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) if (next[key]) params.set(key, next[key] as string);
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }));
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
    const observer = new IntersectionObserver(([entry]) => setFloating(!entry?.isIntersecting), { root: element.closest("[data-app-scroll]") });
    observer.observe(element);
    return () => {
      observer.disconnect();
      setFloating(false);
    };
  }, [canFilter]);

  const buttonLabel = activeKeys.length > 0 ? t("titleCount", { count: activeKeys.length }) : t("title");

  if (!canFilter) return null;

  return (
    <section aria-label={t("title")} aria-busy={isPending} className="flex flex-col gap-stack">
      <div ref={anchor} className="flex items-center justify-between gap-stack">
        <span className="type-secondary text-muted-foreground tabular-nums">{t("show", { count: appliedCount })}</span>
        <Chip selected={activeKeys.length > 0} onClick={() => onOpenChange(true)} aria-haspopup="dialog">
          <Tuning2Icon className="size-icon-sm shrink-0" aria-hidden />
          <span className="truncate">{buttonLabel}</span>
        </Chip>
      </div>
      {floating ? (
        <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--nav-clearance)] z-30">
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
                disabled={draftCount === 0}
                onClick={() => {
                  apply(draft);
                  setOpen(false);
                }}
              >
                {t("show", { count: draftCount })}
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
            <div key={key} role="group" aria-label={t(`labels.${key}`)} className="flex flex-col gap-stack">
              <span className="type-secondary text-muted-foreground">{t(`labels.${key}`)}</span>
              <div className="flex flex-wrap gap-stack">
                <Chip selected={!draft[key]} onClick={() => setDraft({ ...draft, [key]: undefined })}>
                  <span className="truncate">{t("all")}</span>
                </Chip>
                {offeredMap[key].map((option) => (
                  <Chip key={option.value} selected={draft[key] === option.value} onClick={() => setDraft({ ...draft, [key]: option.value })}>
                    <span className="min-w-0 truncate">{option.label}</span>
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
