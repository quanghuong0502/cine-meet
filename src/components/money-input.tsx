"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** "100000" -> "100.000": thousands separated by dots, as VND is written. */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
 * Everything that asks for money uses this, so every amount in the app is typed and read the same way.
 */
export function MoneyInput({ value, defaultValue, onValueChange, name, className, ...props }: Props) {
  const [inner, setInner] = useState(defaultValue === null || defaultValue === undefined ? "" : String(defaultValue).replace(/\D/g, ""));
  const digits = value ?? inner;
  return (
    <>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={groupDigits(digits)}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "");
          setInner(next);
          onValueChange?.(next);
        }}
        className={cn("tabular-nums", className)}
      />
      {name ? <input type="hidden" name={name} value={digits} /> : null}
    </>
  );
}
