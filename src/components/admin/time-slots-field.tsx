"use client";

import { AddIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_TIME_SLOTS, type TimeSlot } from "@/lib/showtime/slots.helpers";

const CONTROL_CLASS = "h-control rounded-xl bg-background px-inset type-body";

function parse(initial: string): TimeSlot[] {
  try {
    const value: unknown = JSON.parse(initial);
    return Array.isArray(value) ? (value as TimeSlot[]) : [];
  } catch {
    return [];
  }
}

/**
 * The time slots of the showtime filter: a list of windows (name, English name, from, to). It travels as one hidden JSON field;
 * the server checks it again (`timeSlotsFieldSchema`). A new slot gets a fresh id; existing ones keep theirs so links with `?slot=` still work.
 */
export function TimeSlotsField({ name, initial, invalid }: { name: string; initial: string; invalid: boolean }) {
  const t = useTranslations("admin.systemSettings.slots");
  const [slots, setSlots] = useState<TimeSlot[]>(() => parse(initial));
  const change = (index: number, patch: Partial<TimeSlot>) => setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));

  return (
    <div className="flex flex-col gap-item" aria-invalid={invalid || undefined}>
      <input type="hidden" name={name} value={JSON.stringify(slots)} />
      {slots.length === 0 ? <p className="type-secondary text-muted-foreground">{t("empty")}</p> : null}
      {slots.map((slot, index) => (
        <fieldset key={slot.id} className="flex min-w-0 flex-col gap-item rounded-xl border bg-card p-inset-sm">
          <div className="flex items-center justify-between gap-item">
            <legend className="type-item-title">{t("slotNumber", { number: index + 1 })}</legend>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${t("remove")} ${index + 1}`}
              onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}
              className="size-target shrink-0 text-muted-foreground hover:text-destructive"
            >
              <TrashBinMinimalisticIcon aria-hidden />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-item sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-stack">
              <Label htmlFor={`${slot.id}-name`} className="text-muted-foreground">
                {t("name")}
              </Label>
              <Input
                id={`${slot.id}-name`}
                value={slot.name}
                onChange={(e) => change(index, { name: e.target.value })}
                maxLength={30}
                placeholder={t("name")}
                autoComplete="off"
                className={CONTROL_CLASS}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-stack">
              <Label htmlFor={`${slot.id}-name-en`} className="text-muted-foreground">
                {t("nameEn")}
              </Label>
              <Input
                id={`${slot.id}-name-en`}
                value={slot.nameEn ?? ""}
                onChange={(e) => change(index, { nameEn: e.target.value })}
                maxLength={30}
                placeholder={t("nameEn")}
                autoComplete="off"
                className={CONTROL_CLASS}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-item">
            <div className="flex min-w-0 flex-col gap-stack">
              <Label htmlFor={`${slot.id}-from`} className="text-muted-foreground">
                {t("from")}
              </Label>
              <Input id={`${slot.id}-from`} type="time" value={slot.from} onChange={(e) => change(index, { from: e.target.value })} className={CONTROL_CLASS} />
            </div>
            <div className="flex min-w-0 flex-col gap-stack">
              <Label htmlFor={`${slot.id}-to`} className="text-muted-foreground">
                {t("to")}
              </Label>
              <Input id={`${slot.id}-to`} type="time" value={slot.to} onChange={(e) => change(index, { to: e.target.value })} className={CONTROL_CLASS} />
            </div>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="cta"
        disabled={slots.length >= MAX_TIME_SLOTS}
        onClick={() => setSlots((current) => [...current, { id: `s${Date.now().toString(36)}`, name: "", from: "", to: "" }])}
      >
        <AddIcon aria-hidden />
        {t("add")}
      </Button>
    </div>
  );
}
