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
        "inline-flex h-target min-w-target max-w-full shrink-0 items-center justify-center gap-stack rounded-full border px-inset type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
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
}

/** Pick exactly one of a few options; the options share the row's width. */
export function ChoiceGroup<T extends string>({ label, value, options, onChange }: ChoiceGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-stack">
      {options.map((option) => (
        <Chip key={option.value} role="radio" selected={option.value === value} onClick={() => onChange(option.value)} className="min-w-0 flex-1 px-inset-xs">
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
