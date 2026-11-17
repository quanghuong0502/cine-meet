"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_TIME_SLOTS, type TimeSlot } from "@/lib/showtime/slots";

const CONTROL_CLASS = "h-control rounded-xl bg-card px-4 text-base";

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
    <div className="flex flex-col gap-3" aria-invalid={invalid || undefined}>
      <input type="hidden" name={name} value={JSON.stringify(slots)} />
      {slots.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      {slots.map((slot, index) => (
        <fieldset key={slot.id} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card/50 p-3">
          <legend className="sr-only">{t("slotNumber", { number: index + 1 })}</legend>
          <Input value={slot.name} onChange={(e) => change(index, { name: e.target.value })} maxLength={30} placeholder={t("name")} aria-label={`${t("name")} ${index + 1}`} autoComplete="off" className={CONTROL_CLASS} />
          <Input value={slot.nameEn ?? ""} onChange={(e) => change(index, { nameEn: e.target.value })} maxLength={30} placeholder={t("nameEn")} aria-label={`${t("nameEn")} ${index + 1}`} autoComplete="off" className={CONTROL_CLASS} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor={`${slot.id}-from`} className="text-muted-foreground">
                {t("from")}
              </Label>
              <Input id={`${slot.id}-from`} type="time" value={slot.from} onChange={(e) => change(index, { from: e.target.value })} className={CONTROL_CLASS} />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor={`${slot.id}-to`} className="text-muted-foreground">
                {t("to")}
              </Label>
              <Input id={`${slot.id}-to`} type="time" value={slot.to} onChange={(e) => change(index, { to: e.target.value })} className={CONTROL_CLASS} />
            </div>
          </div>
          <Button type="button" variant="destructive" size="cta-sm" onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}>
            <Trash2 aria-hidden />
            {t("remove")}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="cta"
        disabled={slots.length >= MAX_TIME_SLOTS}
        onClick={() => setSlots((current) => [...current, { id: `s${Date.now().toString(36)}`, name: "", from: "", to: "" }])}
      >
        <Plus aria-hidden />
        {t("add")}
      </Button>
    </div>
  );
}
