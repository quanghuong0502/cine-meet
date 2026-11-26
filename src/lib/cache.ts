import { unstable_cache } from "next/cache";

/** Shared Next.js cache tags invalidated via `updateTag` in admin/mutation server actions. */
export const SYSTEM_SETTINGS_TAG = "settings:system";
export const CINEMA_DIMENSIONS_TAG = "settings:cinema-dimensions";
export const MASTER_DATA_CATALOG_TAG = "master-data:catalog";
export const MASTER_DATA_PRICING_TAG = "master-data:pricing";
export const CATALOG_MOVIES_TAG = "catalog:movies";
export const CATALOG_CINEMAS_TAG = "catalog:cinemas";

/**
 * Wraps `unstable_cache` with a transparent fallback to `fn` when invoked outside Next.js's incremental
 * cache context (Vitest unit tests, standalone `tsx` seed/worker scripts).
 */
export function safeCache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  options: { tags?: string[]; revalidate?: number | false },
): (...args: A) => Promise<R> {
  const cached = unstable_cache(fn, keyParts, options);
  return async (...args: A) => {
    try {
      return await cached(...args);
    } catch (error) {
      if (error instanceof Error && error.message.includes("incrementalCache")) {
        return fn(...args);
      }
      throw error;
    }
  };
}
