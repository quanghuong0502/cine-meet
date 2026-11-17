import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requiredInt } from "@/lib/validation/fields";
import { SystemSetting } from "@/models/system-setting";
import { recordAudit } from "@/services/audit.service";

export interface SystemSettings {
  /** Minutes before showtime to remind attendees; several values allowed, largest first (e.g. [1440, 20]). */
  reminderMinutesBefore: number[];
  /** By default, invitees must answer this many hours before the showtime. */
  responseDeadlineHours: number;
  /** Minutes of ads before the movie, added to the end time of a showtime. */
  adMinutes: number;
}

export const SETTING_DEFAULTS: SystemSettings = {
  reminderMinutesBefore: [20],
  responseDeadlineHours: 24,
  adMinutes: 15,
};

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
  responseDeadlineHours: requiredInt(1, 168),
  adMinutes: requiredInt(0, 60),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsInputSchema>;

/** Each stored value is checked again on the way out; a bad or missing one falls back to its default. */
const storedSchemas: { [K in keyof SystemSettings]: z.ZodType<SystemSettings[K]> } = {
  reminderMinutesBefore: reminderList,
  responseDeadlineHours: z.number().int().min(1).max(168),
  adMinutes: z.number().int().min(0).max(60),
};

export async function getSystemSettings(): Promise<SystemSettings> {
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

/** Saves the settings; each setting that actually changed is written to the audit log. */
export async function updateSystemSettings(input: SystemSettingsInput, actorId: string): Promise<SystemSettings> {
  const before = await getSystemSettings();
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
  return getSystemSettings();
}
