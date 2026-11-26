/** Pure time-slot constants & helpers (zero `zod` dependency for client bundles). */

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

/** The exclusive end as a comparable "HH:mm" ("00:00" = end of day = "24:00"). */
export const slotEndOf = (slot: Pick<TimeSlot, "to">) => (slot.to === "00:00" ? "24:00" : slot.to);

/** Whether a start time ("HH:mm") falls in the slot. */
export function timeInSlot(slot: TimeSlot, time: string): boolean {
  return time >= slot.from && time < slotEndOf(slot);
}

/** Name for the language in use; the English name falls back to the Vietnamese one. */
export function slotName(slot: TimeSlot, locale: string): string {
  return locale === "en" && slot.nameEn ? slot.nameEn : slot.name;
}

/** "17:00–22:00" (an end of 00:00 is shown as 24:00). */
export function slotRange(slot: TimeSlot): string {
  return `${slot.from}–${slotEndOf(slot)}`;
}
