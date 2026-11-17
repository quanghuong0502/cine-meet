import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { BrandThemeError, DEFAULT_BRAND_HEX, deriveBrandTheme, parseHex } from "@/lib/brand-theme";
import { SystemSetting } from "@/models/system-setting";
import { recordAudit } from "@/services/audit.service";

/** Key of the brand colour in the `systemSettings` collection (one row, like the other system settings). */
const KEY = "brandColor";

const hexSchema = z.string().refine((value) => parseHex(value) !== null);

/** The colour the admin saved as `#RRGGBB` (upper case); the default when none is saved or the stored value is no longer usable. */
export async function getBrandColor(): Promise<string> {
  await connectToDatabase();
  const row = await SystemSetting.findOne({ key: KEY }).lean();
  const parsed = hexSchema.safeParse(row?.value);
  if (!parsed.success) return DEFAULT_BRAND_HEX;
  // A stored colour that could not be derived (a rule changed since) is ignored rather than breaking every page.
  return deriveBrandTheme(parsed.data).ok ? parsed.data.toUpperCase() : DEFAULT_BRAND_HEX;
}

export type SaveBrandColorResult = { ok: true; hex: string } | { ok: false; error: BrandThemeError };

/** Saves the brand colour after checking it can be used (readable button text, visible on the dark card); the change is audited. */
export async function saveBrandColor(hex: string, actorId: string): Promise<SaveBrandColorResult> {
  const derived = deriveBrandTheme(hex);
  if (!derived.ok) return derived;
  const next = hex.trim().toUpperCase();
  const before = await getBrandColor();
  if (before === next) return { ok: true, hex: next };

  const row = await SystemSetting.findOneAndUpdate({ key: KEY }, { $set: { value: next } }, { upsert: true, returnDocument: "after" }).lean();
  await recordAudit({
    actorId,
    action: "update",
    entity: "systemSetting",
    entityId: row._id.toString(),
    before: { key: KEY, value: before },
    after: { key: KEY, value: next },
  });
  return { ok: true, hex: next };
}
