"use client";

import { AddIcon, MinusIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NumberFieldProps {
  id: string;
  value: number | null;
  min: number;
  max: number;
  /** An empty box means "none" (reported as `null`). Otherwise an empty box is only a step while typing. */
  optional?: boolean;
  placeholder?: string;
  invalid?: boolean;
  onChange: (value: number | null) => void;
}

/**
 * A whole-number box with − / + touch steppers. While it has focus it shows exactly what was typed (so it can be emptied
 * to type a new number); a number in range is reported at once, so the map follows the typing.
 */
export function NumberField({ id, value, min, max, optional, placeholder, invalid, onChange }: NumberFieldProps) {
  const t = useTranslations("admin.auditoriums.editor");
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value === null ? "" : String(value);

  function change(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, 3);
    setText(clean);
    if (clean === "") {
      if (optional) onChange(null);
      return;
    }
    const n = Number(clean);
    if (n >= min && n <= max) onChange(n);
  }

  function step(delta: number) {
    const current = value ?? min;
    const next = Math.max(min, Math.min(max, current + delta));
    setFocused(false);
    onChange(next);
  }

  return (
    <div className="flex items-center gap-tight">
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={value === null || value <= min}
        onClick={() => step(-1)}
        aria-label={t("decrease")}
        className="size-target shrink-0 rounded-xl bg-card"
      >
        <MinusIcon aria-hidden />
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onFocus={() => {
          setText(value === null ? "" : String(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(event) => change(event.target.value)}
        className="h-control min-w-0 flex-1 rounded-xl bg-card px-tight text-center type-body tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={value !== null && value >= max}
        onClick={() => step(1)}
        aria-label={t("increase")}
        className="size-target shrink-0 rounded-xl bg-card"
      >
        <AddIcon aria-hidden />
      </Button>
    </div>
  );
}
