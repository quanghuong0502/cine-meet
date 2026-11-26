"use client";

import { useState } from "react";
import { RemoteImage } from "@/components/remote-image";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";

interface ListThumbProps {
  /** The picture. Without it (or when it does not load) the colour is shown, or nothing at all when there is no colour either. */
  imageUrl?: string;
  /** Fallback fill when there is no picture. */
  color?: string;
  /** `poster` keeps a movie poster's 2:3 shape (a little wider than the square, so taller) instead of cropping it square; `poster-lg` is the same shape, bigger (the top of a screen). */
  shape?: "square" | "poster" | "poster-lg";
  /** Optional responsive `sizes` override when `className` scales the thumb across breakpoints. */
  sizes?: string;
  /** Set true only when this thumb is the above-the-fold LCP image. */
  preload?: boolean;
  className?: string;
}

/**
 * The small picture of an item in a list, the same in every list of the app, user and admin alike, so a branch, a brand or a movie looks the same
 * wherever it is listed: a rounded square of `thumb` by default; a movie poster uses `shape="poster"` (`thumb-poster` wide, 2:3, not cropped).
 * Renders nothing when there is neither a picture nor a colour, so a card without them keeps no empty box.
 */
export function ListThumb({ imageUrl, color, shape = "square", sizes, preload, className }: ListThumbProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  if (!showImage && !color) return null;
  const resolvedSizes = sizes ?? `${shape === "poster" ? PX.thumbPoster : shape === "poster-lg" ? PX.thumbPosterLg : PX.thumb}px`;
  return (
    <span
      aria-hidden
      className={cn("relative block shrink-0 overflow-hidden rounded-lg border bg-muted", shape === "poster" ? "aspect-[2/3] w-thumb-poster" : shape === "poster-lg" ? "aspect-[2/3] w-thumb-poster-lg" : "aspect-square w-thumb", className)}
      style={!showImage && color ? { backgroundColor: color } : undefined}
    >
      {showImage && imageUrl ? (
        <RemoteImage
          src={imageUrl}
          alt=""
          fill
          sizes={resolvedSizes}
          preload={preload}
          onError={() => setFailedUrl(imageUrl)}
          className="object-cover"
        />
      ) : null}
    </span>
  );
}
