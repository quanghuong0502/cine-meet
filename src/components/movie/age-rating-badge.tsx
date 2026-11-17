import { inkOn, ratingColor } from "@/lib/age-rating-color";
import { cn } from "@/lib/utils";

interface AgeRatingBadgeProps {
  rating: { code: string; minAge: number; color?: string | null };
  className?: string;
}

/** The age rating as a solid, coloured tag (see `age-rating-color.ts` for what the colours mean). The code is the text, so colour is not the only signal. */
export function AgeRatingBadge({ rating, className }: AgeRatingBadgeProps) {
  const color = ratingColor(rating);
  return (
    <span
      style={{ backgroundColor: color, color: inkOn(color) }}
      className={cn("inline-flex h-auto items-center rounded-md px-2 py-0.5 text-xs font-semibold shadow-sm", className)}
    >
      {rating.code}
    </span>
  );
}
