import { z } from "zod";

/**
 * Reusable zod fields for admin forms. Every message is a validation CODE (see `VALIDATION_CODES`),
 * translated by the interface, so these schemas hold no human-readable text.
 */
export const requiredText = (max: number) =>
  z
    .string({ error: "required" })
    .trim()
    .min(1, { error: "required" })
    .max(max, { error: "too_long" });

export const optionalText = (max: number) =>
  z.string().trim().max(max, { error: "too_long" }).optional();

export const optionalUrl = z
  .url({ error: "invalid_url", protocol: /^https?$/ })
  .max(300, { error: "too_long" })
  .optional();

export const optionalColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "invalid_color" })
  .optional();

/** Optional number in a range; the form sends it as a string. */
export const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number({ error: "invalid_number" }).min(min, { error: "out_of_range" }).max(max, { error: "out_of_range" }))
    .optional();

/** An HTML checkbox sends "on" when checked and nothing when not. */
export const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
