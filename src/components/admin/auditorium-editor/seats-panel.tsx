"use client";

import { RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { NO_SEAT, type SeatFlag } from "@/lib/seat-layout/types";
import { Chip } from "./chips";
import type { EditorSeatType } from "./types";

interface Props {
  seatTypes: EditorSeatType[];
  selectedCount: number;
  /** Every selected cell has this flag / this type. */
  allHaveFlag: (flag: SeatFlag) => boolean;
  allHaveType: (type: string) => boolean;
  onType: (type: string) => void;
  onFlag: (flag: SeatFlag, on: boolean) => void;
  onReset: () => void;
  onClear: () => void;
}

/** The "Seats" tab: what to do with the cells picked on the map (change type, remove, mark broken or blocked, reset). */
export function SeatsPanel({ seatTypes, selectedCount, allHaveFlag, allHaveType, onType, onFlag, onReset, onClear }: Props) {
  const t = useTranslations("admin.auditoriums.editor.seats");
  const idle = selectedCount === 0;

  return (
    <div className="flex flex-col gap-group" role="tabpanel">
      <p role="status" className="type-secondary text-muted-foreground">
        {t("selected", { count: selectedCount })}
      </p>

      <div role="group" aria-label={t("typeGroup")} className="flex flex-wrap gap-stack">
        {seatTypes.map((type) => (
          <Chip key={type.id} disabled={idle} selected={!idle && allHaveType(type.id)} onClick={() => onType(type.id)}>
            <span aria-hidden className="size-icon-xs shrink-0 rounded-sm border border-foreground/20" style={{ backgroundColor: type.color ?? undefined }} />
            {type.name}
          </Chip>
        ))}
        <Chip disabled={idle} selected={!idle && allHaveType(NO_SEAT)} onClick={() => onType(NO_SEAT)}>
          {t("none")}
        </Chip>
      </div>

      <div role="group" aria-label={t("flagGroup")} className="flex flex-wrap gap-stack">
        {(["broken", "obstructed"] as const).map((flag) => {
          const on = !idle && allHaveFlag(flag);
          return (
            <Chip key={flag} disabled={idle} selected={on} onClick={() => onFlag(flag, !on)}>
              {t(flag)}
            </Chip>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-stack">
        <Chip selected={false} disabled={idle} onClick={onReset}>
          <RotateCcw className="size-icon-sm" aria-hidden />
          {t("reset")}
        </Chip>
        <Chip selected={false} disabled={idle} onClick={onClear}>
          <X className="size-icon-sm" aria-hidden />
          {t("clear")}
        </Chip>
      </div>
    </div>
  );
}
