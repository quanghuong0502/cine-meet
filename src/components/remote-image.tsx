"use client";

import Image, { type ImageProps } from "next/image";
import { cloudinaryLoader, isCloudinaryUploadUrl } from "@/lib/cloudinary-url";

/**
 * Tiny dark-plum blur placeholder matching SeatMate's default `--card` surface (0 extra network requests).
 * Next.js displays it behind the image until `onLoad` completes, then removes it so transparent logos stay clean.
 */
const DARK_CARD_BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyMTEwMTgiLz48L3N2Zz4=";

/**
 * Remote image wrapper using Cloudinary's native CDN transforms (`f_auto,q_auto,c_limit,w_*`) via Next.js `loader`.
 * Generates responsive `srcSet` matching `sizes` without Vercel Image Optimization proxy overhead, while passing
 * non-Cloudinary URLs (e.g. Google OAuth avatars, `blob:` previews) through with `unoptimized`.
 */
export function RemoteImage({ alt, src, placeholder, blurDataURL, ...props }: Omit<ImageProps, "loader" | "unoptimized">) {
  if (typeof src === "string" && isCloudinaryUploadUrl(src)) {
    const resolvedPlaceholder = placeholder ?? "blur";
    const resolvedBlur = resolvedPlaceholder === "blur" ? (blurDataURL ?? DARK_CARD_BLUR) : blurDataURL;
    return (
      <Image
        {...props}
        src={src}
        alt={alt}
        loader={cloudinaryLoader}
        placeholder={resolvedPlaceholder}
        blurDataURL={resolvedBlur}
      />
    );
  }
  return <Image {...props} src={src} alt={alt} placeholder={placeholder} blurDataURL={blurDataURL} unoptimized />;
}
