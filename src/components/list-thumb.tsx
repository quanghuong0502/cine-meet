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
  /** `poster` keeps a movie poster's 2:3 shape (a little wider than the square, so taller) instead of cropping it square. */
  shape?: "square" | "poster";
  className?: string;
}

/**
 * The small picture of an item in a list, the same in every list of the app, user and admin alike, so a branch, a brand or a movie looks the same
 * wherever it is listed: a rounded square of `thumb` by default; a movie poster uses `shape="poster"` (`thumb-poster` wide, 2:3, not cropped).
 * Renders nothing when there is neither a picture nor a colour, so a card without them keeps no empty box.
 */
export function ListThumb({ imageUrl, color, shape = "square", className }: ListThumbProps) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;
  if (!showImage && !color) return null;
  return (
    <span
      aria-hidden
      className={cn("relative block shrink-0 overflow-hidden rounded-lg border bg-muted", shape === "poster" ? "aspect-[2/3] w-thumb-poster" : "aspect-square w-thumb", className)}
      style={!showImage && color ? { backgroundColor: color } : undefined}
    >
      {showImage ? <Image src={imageUrl} alt="" fill sizes={`${shape === "poster" ? PX.thumbPoster : PX.thumb}px`} unoptimized onError={() => setFailed(true)} className="object-cover" /> : null}
    </span>
  );
}
