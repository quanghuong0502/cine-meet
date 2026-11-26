"use client";

import Image, { type ImageProps } from "next/image";
import { cloudinaryLoader, isCloudinaryUploadUrl } from "@/lib/cloudinary-url";

/**
 * Remote image wrapper using Cloudinary's native CDN transforms (`f_auto,q_auto,c_limit,w_*`) via Next.js `loader`.
 * Generates responsive `srcSet` matching `sizes` without Vercel Image Optimization proxy overhead, while passing
 * non-Cloudinary URLs (e.g. Google OAuth avatars, `blob:` previews) through with `unoptimized`.
 */
export function RemoteImage({ alt, src, ...props }: Omit<ImageProps, "loader" | "unoptimized">) {
  if (typeof src === "string" && isCloudinaryUploadUrl(src)) {
    return <Image {...props} src={src} alt={alt} loader={cloudinaryLoader} />;
  }
  return <Image {...props} src={src} alt={alt} unoptimized />;
}
