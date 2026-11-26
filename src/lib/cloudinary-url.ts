const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
const EXISTING_TRANSFORMS = /^(?:[a-z]{1,3}_[^/,]+(?:,[a-z]{1,3}_[^/,]+)*)\//;

export function isCloudinaryUploadUrl(src: string): boolean {
  return CLOUDINARY_UPLOAD.test(src);
}

/**
 * Injects responsive Cloudinary delivery transforms (`f_auto,q_auto,c_limit,w_<width>`) into a Cloudinary upload URL.
 * Non-Cloudinary URLs (Google avatars, blob previews, local paths) are returned untouched.
 */
export function cloudinaryUrl(src: string, width: number, quality?: number): string {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return src;
  const [, prefix, rest] = match;
  // Already transformed (avoid duplicating or chaining transforms if called more than once).
  if (EXISTING_TRANSFORMS.test(rest)) return src;
  const q = quality ? `q_${quality}` : "q_auto";
  return `${prefix}f_auto,${q},c_limit,w_${width}/${rest}`;
}

/** Next.js `<Image loader={cloudinaryLoader} />` compatible loader: generates responsive `srcSet` straight from Cloudinary CDN. */
export function cloudinaryLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  return cloudinaryUrl(src, width, quality);
}
