"use client";

import { CloseIcon, RestartIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { NO_SEAT, type SeatFlag } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";
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
      <p
        role="status"
        className={cn(
          "type-secondary",
          idle ? "rounded-xl border bg-card px-inset py-inset-sm text-muted-foreground" : "font-medium text-foreground tabular-nums",
        )}
      >
        {t("selected", { count: selectedCount })}
      </p>
      <Section title={t("typeGroup")}>
        {seatTypes.map((type) => (
          <Chip key={type.id} disabled={idle} selected={!idle && allHaveType(type.id)} onClick={() => onType(type.id)}>
            <span aria-hidden className="size-icon-xs shrink-0 rounded-sm border border-foreground/20" style={{ backgroundColor: type.color ?? undefined }} />
            {type.name}
          </Chip>
        ))}
        <Chip disabled={idle} selected={!idle && allHaveType(NO_SEAT)} onClick={() => onType(NO_SEAT)}>
          {t("none")}
        </Chip>
      </Section>

      <Section title={t("flagGroup")}>
        {(["broken", "obstructed", "recommended"] as const).map((flag) => {
          const on = !idle && allHaveFlag(flag);
          return (
            <Chip key={flag} disabled={idle} selected={on} onClick={() => onFlag(flag, !on)}>
              {t(flag)}
            </Chip>
          );
        })}
      </Section>

      <Section title={t("actionGroup")}>
        <Chip selected={false} disabled={idle} onClick={onReset}>
          <RestartIcon className="size-icon-sm" aria-hidden />
          {t("reset")}
        </Chip>
        <Chip selected={false} disabled={idle} onClick={onClear}>
          <CloseIcon className="size-icon-sm" aria-hidden />
          {t("clear")}
        </Chip>
      </Section>
    </div>
  );
}

/** One kind of action under its own small heading, so the chips read as groups (what the cell is, its condition, what to do with it). */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-stack">
      <p aria-hidden className="type-item-title">
        {title}
      </p>
      <div className="flex flex-wrap gap-stack">{children}</div>
    </div>
  );
}
