"use client";

import { useState } from "react";
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
 * A whole-number box. While it has focus it shows exactly what was typed (so it can be emptied to type a new number);
 * a number in range is reported at once, so the map follows the typing. When it loses focus it shows the real value again.
 */
export function NumberField({ id, value, min, max, optional, placeholder, invalid, onChange }: NumberFieldProps) {
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

  return (
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
      className="h-control rounded-xl bg-card px-4 type-body"
    />
  );
}
