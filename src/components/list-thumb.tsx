"use client";

import Image from "next/image";
import { useState } from "react";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";

interface ListThumbProps {
  /** The picture. Without it (or when it does not load) the colour is shown, or nothing at all when there is no colour either. */
  imageUrl?: string;
  /** Fallback fill when there is no picture. */
  color?: string;
  className?: string;
}

/**
 * The small picture of an item in a list: one size and one shape (a rounded square of `size-thumb`) for every list in the app,
 * user and admin alike, so a branch, a brand or a movie looks the same wherever it is listed.
 * Renders nothing when there is neither a picture nor a colour, so a card without them keeps no empty box.
 */
export function ListThumb({ imageUrl, color, className }: ListThumbProps) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;
  if (!showImage && !color) return null;
  return (
    <span
      aria-hidden
      className={cn("relative block size-thumb shrink-0 overflow-hidden rounded-lg border bg-muted", className)}
      style={!showImage && color ? { backgroundColor: color } : undefined}
    >
      {showImage ? <Image src={imageUrl} alt="" fill sizes={`${PX.thumb}px`} unoptimized onError={() => setFailed(true)} className="object-cover" /> : null}
    </span>
  );
}
