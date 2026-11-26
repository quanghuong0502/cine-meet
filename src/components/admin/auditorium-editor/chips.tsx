"use client";

import { cn } from "@/lib/utils";

interface ChipProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  selected: boolean;
  onClick: () => void;
  /** `radio` inside a `ChoiceGroup`; plain toggle button otherwise. */
  role?: "radio";
}

/** A 44px pill that is either on or off. On state is shown by fill AND `aria-pressed`/`aria-checked`, not by colour alone. */
export function Chip({ selected, onClick, role, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      role={role}
      aria-pressed={role ? undefined : selected}
      aria-checked={role ? selected : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-target min-w-target max-w-full shrink-0 items-center justify-center gap-stack rounded-full border px-inset py-inset-xs type-label whitespace-nowrap transition-[color,background-color,border-color,opacity,transform,filter] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:brightness-90 motion-safe:active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * Pick exactly one of a few options; sizes each pill by its label (`flex-auto`) so narrow screens wrap onto tidy rows
 * instead of squeezing and clipping text.
 */
export function ChoiceGroup<T extends string>({ label, value, options, onChange, disabled }: ChoiceGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-stack">
      {options.map((option) => (
        <Chip
          key={option.value}
          role="radio"
          disabled={disabled}
          selected={option.value === value}
          onClick={() => onChange(option.value)}
          className="flex-auto px-inset-sm whitespace-normal text-center leading-tight"
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
