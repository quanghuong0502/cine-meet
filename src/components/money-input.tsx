"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** "100000" -> "100.000": thousands separated by dots, as VND is written. */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function normalizeDigits(raw: string): string {
  const only = raw.replace(/\D/g, "");
  return only.length > 1 ? only.replace(/^0+(?=\d)/, "") : only;
}

/** Finds the caret index inside `formatted` that leaves exactly `digitsBefore` digits to the left. */
function caretForDigitCount(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen++;
      if (seen === digitsBefore) return i + 1;
    }
  }
  return formatted.length;
}

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type" | "name"> & {
  /** Controlled: the amount as plain digits ("100000"). */
  value?: string;
  /** Uncontrolled: starting amount. */
  defaultValue?: string | number | null;
  /** Gets plain digits, never the dots. */
  onValueChange?: (digits: string) => void;
  /** For a plain form post: the amount is sent as digits through a hidden field of this name. */
  name?: string;
};

/**
 * Text box for an amount in VND: shows the dots while typing ("100.000"), keeps only digits as the value, opens the number pad.
 * Preserves caret position on mid-string edits and handles Backspace immediately after a dot separator cleanly.
 */
export function MoneyInput({ value, defaultValue, onValueChange, name, className, onKeyDown, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState(defaultValue === null || defaultValue === undefined ? "" : normalizeDigits(String(defaultValue)));
  const digits = value ?? inner;
  const formatted = groupDigits(digits);

  function commit(nextDigits: string, nextDigitsBeforeCaret: number) {
    setInner(nextDigits);
    onValueChange?.(nextDigits);
    const nextFormatted = groupDigits(nextDigits);
    const pos = caretForDigitCount(nextFormatted, nextDigitsBeforeCaret);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el && document.activeElement === el) el.setSelectionRange(pos, pos);
    });
  }

  return (
    <>
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatted}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Backspace") return;
          const el = event.currentTarget;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? 0;
          if (start !== end || start <= 0 || formatted[start - 1] !== ".") return;
          // Backspace directly after a dot: delete the digit before the dot instead of silently putting the dot back.
          event.preventDefault();
          const digitsBefore = formatted.slice(0, start).replace(/\D/g, "").length;
          if (digitsBefore <= 0) return;
          const next = normalizeDigits(digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore));
          commit(next, Math.max(0, digitsBefore - 1));
        }}
        onChange={(event) => {
          const raw = event.target.value;
          const caret = event.target.selectionStart ?? raw.length;
          const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
          const rawDigits = raw.replace(/\D/g, "");
          const next = normalizeDigits(rawDigits);
          const trimmedZeros = rawDigits.length - next.length;
          commit(next, Math.max(0, digitsBefore - trimmedZeros));
        }}
        className={cn("tabular-nums", className)}
      />
      {name ? <input type="hidden" name={name} value={digits} /> : null}
    </>
  );
}
