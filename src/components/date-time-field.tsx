"use client";

import { CalendarIcon, ClockCircleIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateTimeFieldProps {
  id?: string;
  kind: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  /** Earliest and latest value the picker offers (a date as YYYY-MM-DD). The browser limits the choice; the form still checks it. */
  min?: string;
  max?: string;
  required?: boolean;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  disabled?: boolean;
  /** The field lost focus: the picker was closed, so the choice is final. (`onChange` also fires while the picker is still being turned.) */
  onBlur?: () => void;
  /** Name for screen readers (the visible words are only a hint while the field is empty). */
  label: string;
  className?: string;
}

/**
 * A date or time field that still opens the system's own picker, but reads "Pick a date" / "Pick a time" while empty instead of the
 * browser's "dd/mm/yyyy" and "--:--". The browser's empty text is made see-through and our hint sits over it; once focused or a value is
 * chosen the browser's own text shows again. Same height as every other input (48px).
 */
export function DateTimeField({
  id,
  kind,
  value,
  onChange,
  onBlur,
  min,
  max,
  required,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  disabled,
  label,
  className,
}: DateTimeFieldProps) {
  const t = useTranslations("dateTimeField");
  const [focused, setFocused] = useState(false);
  const empty = value === "";
  const showHint = empty && !focused;
  const Icon = kind === "date" ? CalendarIcon : ClockCircleIcon;
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type={kind}
        min={min}
        max={max}
        required={required}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        className={cn(
          "relative h-control w-full rounded-xl bg-card pr-control pl-inset type-body text-left [&::-webkit-date-and-time-value]:text-left",
          "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
          showHint && "[&::-webkit-datetime-edit]:text-transparent",
        )}
      />
      <Icon aria-hidden className="pointer-events-none absolute top-1/2 right-inset size-icon -translate-y-1/2 text-muted-foreground" />
      {showHint ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center pr-control pl-inset type-body text-muted-foreground">
          <span className="truncate">{t(kind === "date" ? "pickDate" : "pickTime")}</span>
        </span>
      ) : null}
    </div>
  );
}
