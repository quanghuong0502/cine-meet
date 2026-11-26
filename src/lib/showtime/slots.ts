import { z } from "zod";
import { MAX_TIME_SLOTS, slotEndOf } from "./slots.helpers";

export {
  DEFAULT_TIME_SLOTS,
  MAX_TIME_SLOTS,
  slotName,
  slotRange,
  timeInSlot,
  type TimeSlot,
} from "./slots.helpers";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const timeSlotSchema = z.object({
  id: z.string({ error: "invalid" }).regex(/^[a-z0-9-]{1,24}$/, { error: "invalid" }),
  name: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(30, { error: "too_long" }),
  nameEn: z
    .string()
    .trim()
    .max(30, { error: "too_long" })
    .optional()
    .transform((value) => value || undefined),
  from: z.string({ error: "invalid" }).regex(HHMM, { error: "invalid" }),
  to: z.string({ error: "invalid" }).regex(HHMM, { error: "invalid" }),
});

/** A list of slots: each one ends after it starts, none overlap, ids are unique. Codes: invalid (a slot is wrong), out_of_range (overlap or too many). */
export const timeSlotsSchema = z
  .array(timeSlotSchema)
  .max(MAX_TIME_SLOTS, { error: "out_of_range" })
  .superRefine((slots, ctx) => {
    if (new Set(slots.map((slot) => slot.id)).size !== slots.length) ctx.addIssue({ code: "custom", message: "invalid" });
    if (slots.some((slot) => slot.from >= slotEndOf(slot))) {
      ctx.addIssue({ code: "custom", message: "invalid" });
      return;
    }
    const sorted = [...slots].sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].from < slotEndOf(sorted[i - 1])) ctx.addIssue({ code: "custom", message: "out_of_range" });
    }
  });

/** The form sends the slots as JSON text. */
export const timeSlotsFieldSchema = z
  .string({ error: "required" })
  .transform((text, ctx): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      ctx.addIssue({ code: "custom", message: "invalid" });
      return z.NEVER;
    }
  })
  .pipe(timeSlotsSchema);
