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
      title={rating.code}
      style={{ backgroundColor: color, color: inkOn(color) }}
      className={cn("inline-flex h-auto items-center rounded-md px-inset-xs py-hair type-tag font-semibold! shadow-sm ring-1 ring-black/20", className)}
    >
      {rating.code}
    </span>
  );
}
