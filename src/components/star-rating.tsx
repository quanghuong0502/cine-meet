"use client";

import { StarIcon as StarFilledIcon } from "@solar-icons/react/bold";
import { StarIcon } from "@solar-icons/react/line-duotone";

/** Five tappable 44px stars, 1 to 5. Used for a person's own rating of a movie, seat or room (never a community score). */
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
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: number) {
    if (disabled) return;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(5, current + 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(Math.max(1, current - 1));
    }
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-stack">
      {[1, 2, 3, 4, 5].map((n) => {
        const checked = value === n;
        const tabStop = checked || (value === 0 && n === 1);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${n}/5`}
            tabIndex={tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(n)}
            onKeyDown={(event) => onKeyDown(event, n)}
            className="inline-flex size-target items-center justify-center rounded-full transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:active:scale-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {n <= value ? (
              <StarFilledIcon className="size-icon-lg text-primary" aria-hidden />
            ) : (
              <StarIcon className="size-icon-lg text-muted-foreground" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
