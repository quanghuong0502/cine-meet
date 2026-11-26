import { cache } from "react";
import { z } from "zod";
import { safeCache, SYSTEM_SETTINGS_TAG } from "@/lib/cache";
import { connectToDatabase } from "@/lib/db";
import { DEFAULT_TIME_SLOTS, timeSlotsFieldSchema, timeSlotsSchema, type TimeSlot } from "@/lib/showtime/slots";
import { requiredInt } from "@/lib/validation/fields";
import { SystemSetting } from "@/models/system-setting";
import { recordAudit } from "@/services/audit.service";
import { recomputeAllReminders } from "@/services/scheduled-notification.service";

export interface SystemSettings {
  /** Minutes before showtime to remind attendees; several values allowed, largest first (e.g. [1440, 20]). */
  reminderMinutesBefore: number[];
  /** The answer-by time of an appointment must be at least this many minutes before its earliest showtime. */
  responseDeadlineMinutes: number;
  /** Minutes of ads before the movie, added to the end time of a showtime. */
  adMinutes: number;
  /** The movie filter also offers movies that start within this many days (movies already showing are always offered). */
  movieUpcomingDays: number;
  /** Windows of the day (by start time) offered in the showtime filter. */
  timeSlots: TimeSlot[];
  /** How many hours a push waits at the push service for a phone that is offline; after that it is dropped (in-app notifications stay). */
  pushTtlHours: number;
}

export const SETTING_DEFAULTS: SystemSettings = {
  reminderMinutesBefore: [20],
  responseDeadlineMinutes: 60,
  adMinutes: 15,
  movieUpcomingDays: 30,
  timeSlots: DEFAULT_TIME_SLOTS,
  pushTtlHours: 24,
};

/** Four weeks: the longest wait Google's push service allows. */
export const MAX_PUSH_TTL_HOURS = 28 * 24;

/** A week. */
export const MAX_DEADLINE_MINUTES = 7 * 24 * 60;

export const MAX_REMINDERS = 5;
export const MAX_REMINDER_MINUTES = 7 * 24 * 60;

/** "1440, 20" -> [1440, 20] (largest first, no repeats). Anything that is not a whole number stays NaN so validation rejects it. */
function parseMinutesList(text: string): number[] {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  return [...new Set(parts.map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN)))].sort((a, b) => b - a);
}

const reminderList = z
  .array(
    z
      .number({ error: "invalid_number" })
      .int({ error: "invalid_number" })
      .min(1, { error: "out_of_range" })
      .max(MAX_REMINDER_MINUTES, { error: "out_of_range" }),
  )
  .min(1, { error: "required" })
  .max(MAX_REMINDERS, { error: "out_of_range" });

/** The form sends the reminders as text such as "1440, 20". */
export const systemSettingsInputSchema = z.object({
  reminderMinutesBefore: z
    .string({ error: "required" })
    .transform(parseMinutesList)
    .pipe(reminderList),
  responseDeadlineMinutes: requiredInt(0, MAX_DEADLINE_MINUTES),
  adMinutes: requiredInt(0, 60),
  movieUpcomingDays: requiredInt(0, 365),
  timeSlots: timeSlotsFieldSchema,
  pushTtlHours: requiredInt(1, MAX_PUSH_TTL_HOURS),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsInputSchema>;

/** Each stored value is checked again on the way out; a bad or missing one falls back to its default. */
const storedSchemas: { [K in keyof SystemSettings]: z.ZodType<SystemSettings[K]> } = {
  reminderMinutesBefore: reminderList,
  responseDeadlineMinutes: z.number().int().min(0).max(MAX_DEADLINE_MINUTES),
  adMinutes: z.number().int().min(0).max(60),
  movieUpcomingDays: z.number().int().min(0).max(365),
  timeSlots: timeSlotsSchema,
  pushTtlHours: z.number().int().min(1).max(MAX_PUSH_TTL_HOURS),
};

async function readSystemSettings(): Promise<SystemSettings> {
  await connectToDatabase();
  const rows = await SystemSetting.find({}).lean();
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const result: SystemSettings = { ...SETTING_DEFAULTS };
  for (const key of Object.keys(storedSchemas) as (keyof SystemSettings)[]) {
    const parsed = storedSchemas[key].safeParse(stored.get(key));
    if (parsed.success) (result as unknown as Record<string, unknown>)[key] = parsed.data;
  }
  return result;
}

const getSystemSettingsCached = safeCache(readSystemSettings, ["system-settings"], {
  tags: [SYSTEM_SETTINGS_TAG],
  revalidate: 3600,
});

/** Cached across requests (tag `settings:system`) and deduplicated within one render via React `cache()`. */
export const getSystemSettings = cache(() => getSystemSettingsCached());

/** Saves the settings; each setting that actually changed is written to the audit log. */
export async function updateSystemSettings(input: SystemSettingsInput, actorId: string): Promise<SystemSettings> {
  const before = await readSystemSettings();
  for (const key of Object.keys(storedSchemas) as (keyof SystemSettings)[]) {
    const next = input[key];
    if (JSON.stringify(next) === JSON.stringify(before[key])) continue;
    const row = await SystemSetting.findOneAndUpdate(
      { key },
      { $set: { value: next } },
      { upsert: true, returnDocument: "after" },
    ).lean();
    await recordAudit({
      actorId,
      action: "update",
      entity: "systemSetting",
      entityId: row._id.toString(),
      before: { key, value: before[key] },
      after: { key, value: next },
    });
  }
  const after = await readSystemSettings();
  // The lead times moved: every confirmed appointment's scheduled reminders (#8) have to match the new values.
  if (JSON.stringify(before.reminderMinutesBefore) !== JSON.stringify(after.reminderMinutesBefore)) await recomputeAllReminders();
  return after;
}
