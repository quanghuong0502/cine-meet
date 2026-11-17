import { z } from "zod";

/** A time-of-day window the admin defines for filtering showtimes by when they START (Vietnam time). */
export interface TimeSlot {
  /** Stable key used in the URL (`?slot=`); never shown. */
  id: string;
  name: string;
  nameEn?: string;
  /** "HH:mm", inclusive. */
  from: string;
  /** "HH:mm", exclusive. "00:00" means the end of the day. */
  to: string;
}

export const MAX_TIME_SLOTS = 8;

/** What a system without saved slots shows: the four windows the filter always had. */
export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { id: "morning", name: "Sáng", nameEn: "Morning", from: "00:00", to: "12:00" },
  { id: "afternoon", name: "Chiều", nameEn: "Afternoon", from: "12:00", to: "17:00" },
  { id: "evening", name: "Tối", nameEn: "Evening", from: "17:00", to: "22:00" },
  { id: "late", name: "Khuya", nameEn: "Late night", from: "22:00", to: "00:00" },
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The exclusive end as a comparable "HH:mm" ("00:00" = end of day = "24:00"). */
const endOf = (slot: Pick<TimeSlot, "to">) => (slot.to === "00:00" ? "24:00" : slot.to);

/** Whether a start time ("HH:mm") falls in the slot. */
export function timeInSlot(slot: TimeSlot, time: string): boolean {
  return time >= slot.from && time < endOf(slot);
}

/** Name for the language in use; the English name falls back to the Vietnamese one. */
export function slotName(slot: TimeSlot, locale: string): string {
  return locale === "en" && slot.nameEn ? slot.nameEn : slot.name;
}

/** "17:00–22:00" (an end of 00:00 is shown as 24:00). */
export function slotRange(slot: TimeSlot): string {
  return `${slot.from}–${endOf(slot)}`;
}

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
    if (slots.some((slot) => slot.from >= endOf(slot))) {
      ctx.addIssue({ code: "custom", message: "invalid" });
      return;
    }
    const sorted = [...slots].sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].from < endOf(sorted[i - 1])) ctx.addIssue({ code: "custom", message: "out_of_range" });
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
