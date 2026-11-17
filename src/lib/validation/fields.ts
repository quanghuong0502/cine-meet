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

/** A required id of another record (24 hex characters). */
export const objectIdField = z
  .string({ error: "required" })
  .regex(/^[0-9a-fA-F]{24}$/, { error: "invalid" });

/** A required whole number in a range; the form sends it as a string. */
export const requiredInt = (min: number, max: number) =>
  z
    .string({ error: "required" })
    .transform((value) => Number(value))
    .pipe(
      z
        .number({ error: "invalid_number" })
        .int({ error: "invalid_number" })
        .min(min, { error: "out_of_range" })
        .max(max, { error: "out_of_range" }),
    );

export const optionalInt = (min: number, max: number) => requiredInt(min, max).optional();

/** True for a real calendar date written YYYY-MM-DD (no time zone: Vietnam calendar days). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const requiredDate = z
  .string({ error: "required" })
  .refine(isCalendarDate, { error: "invalid_date" });

export const optionalDate = requiredDate.optional();

/** `validTo` may not be before `validFrom` (both optional). Use as `.superRefine(validRange)`. */
export function validRange(value: { validFrom?: string; validTo?: string }, ctx: z.RefinementCtx) {
  if (value.validFrom && value.validTo && value.validTo < value.validFrom) {
    ctx.addIssue({ code: "custom", path: ["validTo"], message: "out_of_range" });
  }
}

/** Several ids of other records, sent by a multi-pick as one comma-separated string; empty means none. */
export const idList = z
  .string()
  .optional()
  .transform((value) => (value ? [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))] : []))
  .pipe(z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, { error: "invalid" })));
