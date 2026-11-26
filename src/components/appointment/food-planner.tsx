"use client";

import { AddIcon, LoaderIcon, MinusIcon, UsersGroupRoundedIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { setFoodAction, type ActionResult } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { PersonChip } from "@/components/appointment/person-chip";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";
import type { FoodLine } from "@/components/appointment/use-plan-draft";

interface Props {
  view: AppointmentView;
  food: PlanData["food"];
  onSave: (action: () => Promise<ActionResult>, done: string) => void;
  busy: boolean;
  /** While the plan is being made nothing is saved: every change goes here, there is no save button, and the list starts from `initialLines`. */
  onDraft?: (lines: FoodLine[]) => void;
  initialLines?: FoodLine[];
  hideHeading?: boolean;
}

const SHARED = "shared";
const ALL = "all";
const COMBOS = "combos";
const OTHER = "other";
const key = (owner: string, kind: string, refId: string) => `${owner}|${kind}|${refId}`;

/** Food and drinks: pick whose they are (the whole group's, or one person's), then set how many of each. Saved with one button. */
export function FoodPlanner({ view, food, onSave, busy, onDraft, initialLines, hideHeading = false }: Props) {
  const t = useTranslations("appointments.detail.plan");
  const locale = useLocale();
  const [owner, setOwner] = useState(SHARED);
  // Which kind is listed: everything, one category, combos, or the items that have no category.
  const [filter, setFilter] = useState<string>(ALL);
  const [qty, setQty] = useState(() => new Map((initialLines ?? view.fnb).map((l) => [key(l.ownerId ?? SHARED, l.kind, l.refId), l.quantity])));
  const [dirty, setDirty] = useState(false);

  const count = (kind: "item" | "combo", id: string) => qty.get(key(owner, kind, id)) ?? 0;
  const countForOwner = (who: string) => {
    let total = 0;
    for (const [k, n] of qty) if (k.startsWith(`${who}|`)) total += n;
    return total;
  };
  function toLines(map: Map<string, number>): FoodLine[] {
    return [...map].map(([k, quantity]) => {
      const [who, kind, refId] = k.split("|") as [string, "item" | "combo", string];
      return { ownerId: who === SHARED ? undefined : who, kind, refId, quantity };
    });
  }
  function change(kind: "item" | "combo", id: string, delta: number) {
    const next = new Map(qty);
    const value = Math.max(0, Math.min(20, count(kind, id) + delta));
    if (value === 0) next.delete(key(owner, kind, id));
    else next.set(key(owner, kind, id), value);
    setQty(next);
    setDirty(true);
    onDraft?.(toLines(next));
  }

  function save() {
    const lines = toLines(qty);
    onSave(async () => {
      const result = await setFoodAction(view.id, { lines });
      if (result.ok) setDirty(false);
      return result;
    }, t("foodSaved"));
  }

  const rows = [
    ...food.combos.map((c) => ({ kind: "combo" as const, categoryId: undefined as string | undefined, ...c })),
    ...food.items.map((i) => ({ kind: "item" as const, ...i })),
  ];
  const known = new Set(food.categories.map((c) => c.id));
  const hasOther = food.items.some((i) => !i.categoryId || !known.has(i.categoryId));
  const shown = rows.filter((row) => {
    if (filter === ALL) return true;
    if (filter === COMBOS) return row.kind === "combo";
    if (row.kind === "combo") return false;
    if (filter === OTHER) return !row.categoryId || !known.has(row.categoryId);
    return row.categoryId === filter;
  });

  const sharedTotal = countForOwner(SHARED);

  return (
    <section aria-labelledby={hideHeading ? undefined : "appt-food"} aria-label={hideHeading ? t("foodTitle") : undefined} className="flex flex-col gap-item">
      {hideHeading ? null : (
        <h2 id="appt-food" className="type-heading">
          {t("foodTitle")}
        </h2>
      )}
      <div role="group" aria-label={t("foodFor")} className="scroll-strip flex gap-stack pb-tight">
        <PersonChip
          selected={owner === SHARED}
          onClick={() => setOwner(SHARED)}
          icon={<UsersGroupRoundedIcon className="size-icon" aria-hidden />}
          label={t("foodShared")}
          trailing={sharedTotal > 0 ? String(sharedTotal) : undefined}
        />
        {view.attendees.map((p) => {
          const ownerCount = countForOwner(p.id);
          return (
            <PersonChip
              key={p.id}
              person={{ name: p.name, avatar: p.avatar }}
              selected={owner === p.id}
              onClick={() => setOwner(p.id)}
              trailing={ownerCount > 0 ? String(ownerCount) : undefined}
            />
          );
        })}
      </div>
      {food.categories.length > 0 || food.combos.length > 0 ? (
        <div role="group" aria-label={t("foodFilter")} className="scroll-strip flex gap-stack pb-tight">
          <Chip selected={filter === ALL} onClick={() => setFilter(ALL)}>
            <span className="truncate">{t("foodAll")}</span>
          </Chip>
          {food.categories.map((c) => (
            <Chip key={c.id} selected={filter === c.id} onClick={() => setFilter(c.id)}>
              <span className="truncate">{locale === "en" && c.nameEn ? c.nameEn : c.name}</span>
            </Chip>
          ))}
          {food.combos.length > 0 ? (
            <Chip selected={filter === COMBOS} onClick={() => setFilter(COMBOS)}>
              <span className="truncate">{t("foodCombos")}</span>
            </Chip>
          ) : null}
          {hasOther && food.categories.length > 0 ? (
            <Chip selected={filter === OTHER} onClick={() => setFilter(OTHER)}>
              <span className="truncate">{t("foodOther")}</span>
            </Chip>
          ) : null}
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="py-inset text-center type-secondary text-muted-foreground">{t("noFood")}</p>
      ) : (
        <ul className="flex flex-col gap-stack">
          {shown.map((row) => {
            const n = count(row.kind, row.id);
            return (
              <li
                key={`${row.kind}-${row.id}`}
                className={cn(
                  "flex items-center gap-item rounded-xl border p-inset-sm transition-colors",
                  n > 0 ? "border-primary/50 bg-accent/35" : "bg-card",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-tight">
                  <span className="break-words type-item-title">{row.name}</span>
                  <span className="type-secondary text-muted-foreground tabular-nums">{formatVnd(row.price, locale)}</span>
                </span>
                {n === 0 ? (
                  <Button type="button" variant="outline" size="icon" aria-label={t("more", { name: row.name })} disabled={busy} onClick={() => change(row.kind, row.id, 1)} className="shrink-0 rounded-full">
                    <AddIcon aria-hidden />
                  </Button>
                ) : (
                  <span className="flex shrink-0 items-center gap-stack">
                    <Button type="button" variant="outline" size="icon" aria-label={t("less", { name: row.name })} disabled={busy} onClick={() => change(row.kind, row.id, -1)} className="rounded-full">
                      <MinusIcon aria-hidden />
                    </Button>
                    <span className="min-w-stepper text-center type-item-title tabular-nums" aria-live="polite">
                      {n}
                    </span>
                    <Button type="button" variant="outline" size="icon" aria-label={t("more", { name: row.name })} disabled={busy || n >= 20} onClick={() => change(row.kind, row.id, 1)} className="rounded-full">
                      <AddIcon aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {onDraft ? null : (
        <Button type="button" size="cta" disabled={busy || !dirty} onClick={save}>
          {busy ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : null}
          {t("saveFood")}
        </Button>
      )}
    </section>
  );
}
