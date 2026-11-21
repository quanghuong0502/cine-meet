"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Five tappable stars, 1 to 5. Used for a person's own rating of a movie, seat or room (never a community score). */
export function StarRating({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-tight">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={String(n)}
          disabled={disabled}
          onClick={() => onChange(n)}
          className="p-tight"
        >
          <Star className={cn("size-icon", n <= value ? "fill-primary text-primary" : "text-muted-foreground")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
