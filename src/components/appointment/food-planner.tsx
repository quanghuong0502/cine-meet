"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { setFoodAction, type ActionResult } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";

interface Props {
  view: AppointmentView;
  food: PlanData["food"];
  onSave: (action: () => Promise<ActionResult>, done: string) => void;
  busy: boolean;
}

const SHARED = "shared";
const key = (owner: string, kind: string, refId: string) => `${owner}|${kind}|${refId}`;

/** Food and drinks: pick whose they are (the whole group's, or one person's), then set how many of each. Saved with one button. */
export function FoodPlanner({ view, food, onSave, busy }: Props) {
  const t = useTranslations("appointments.detail.plan");
  const locale = useLocale();
  const [owner, setOwner] = useState(SHARED);
  const [qty, setQty] = useState(() => new Map(view.fnb.map((l) => [key(l.ownerId ?? SHARED, l.kind, l.refId), l.quantity])));
  const [dirty, setDirty] = useState(false);

  const count = (kind: "item" | "combo", id: string) => qty.get(key(owner, kind, id)) ?? 0;
  function change(kind: "item" | "combo", id: string, delta: number) {
    const next = new Map(qty);
    const value = Math.max(0, Math.min(20, count(kind, id) + delta));
    if (value === 0) next.delete(key(owner, kind, id));
    else next.set(key(owner, kind, id), value);
    setQty(next);
    setDirty(true);
  }

  function save() {
    const lines = [...qty].map(([k, quantity]) => {
      const [who, kind, refId] = k.split("|") as [string, "item" | "combo", string];
      return { ownerId: who === SHARED ? undefined : who, kind, refId, quantity };
    });
    onSave(async () => {
      const result = await setFoodAction(view.id, { lines });
      if (result.ok) setDirty(false);
      return result;
    }, t("foodSaved"));
  }

  const rows = [
    ...food.combos.map((c) => ({ kind: "combo" as const, ...c })),
    ...food.items.map((i) => ({ kind: "item" as const, ...i })),
  ];

  return (
    <section aria-labelledby="appt-food" className="flex flex-col gap-item">
      <h2 id="appt-food" className="type-heading">
        {t("foodTitle")}
      </h2>
      <div role="group" aria-label={t("foodFor")} className="scroll-strip flex gap-stack pb-tight">
        <Chip selected={owner === SHARED} onClick={() => setOwner(SHARED)}>
          {t("foodShared")}
        </Chip>
        {view.attendees.map((p) => (
          <Chip key={p.id} selected={owner === p.id} onClick={() => setOwner(p.id)}>
            {p.name}
          </Chip>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-inset text-center type-secondary text-muted-foreground">{t("noFood")}</p>
      ) : (
        <ul className="flex flex-col gap-stack">
          {rows.map((row) => {
            const n = count(row.kind, row.id);
            return (
              <li key={`${row.kind}-${row.id}`} className="flex items-center gap-item rounded-xl border bg-card p-inset-sm">
                <span className="flex min-w-0 flex-1 flex-col gap-tight">
                  <span className="break-words type-item-title">{row.name}</span>
                  <span className="type-secondary text-muted-foreground tabular-nums">{formatVnd(row.price, locale)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-stack">
                  <Button type="button" variant="outline" size="icon" aria-label={t("less", { name: row.name })} disabled={busy || n === 0} onClick={() => change(row.kind, row.id, -1)}>
                    <Minus aria-hidden />
                  </Button>
                  <span className="min-w-target text-center type-item-title tabular-nums" aria-live="polite">
                    {n}
                  </span>
                  <Button type="button" variant="outline" size="icon" aria-label={t("more", { name: row.name })} disabled={busy || n >= 20} onClick={() => change(row.kind, row.id, 1)}>
                    <Plus aria-hidden />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" size="cta" disabled={busy || !dirty} onClick={save}>
        {t("saveFood")}
      </Button>
    </section>
  );
}
