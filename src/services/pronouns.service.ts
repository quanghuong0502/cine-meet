import { connectToDatabase } from "@/lib/db";
import { DEFAULT_PRONOUNS, parsePronoun, type PronounError, type Pronouns } from "@/lib/pronouns";
import { SystemSetting } from "@/models/system-setting";
import { recordAudit } from "@/services/audit.service";

/** Key of the pair in the `systemSettings` collection (one row, like the other system settings). */
const KEY = "pronouns";

/** The pair the admin saved; the default when none is saved or the stored value is no longer usable. */
export async function getPronouns(): Promise<Pronouns> {
  await connectToDatabase();
  const row = await SystemSetting.findOne({ key: KEY }).lean();
  const value = row?.value as Partial<Pronouns> | undefined;
  const you = parsePronoun(typeof value?.you === "string" ? value.you : "");
  const me = parsePronoun(typeof value?.me === "string" ? value.me : "");
  return you.ok && me.ok ? { you: you.value, me: me.value } : DEFAULT_PRONOUNS;
}

export type SavePronounsResult = { ok: true; pronouns: Pronouns } | { ok: false; fieldErrors: Partial<Record<keyof Pronouns, PronounError>> };

/** Saves the pair after cleaning and checking both words; the change is audited. */
export async function savePronouns(input: { you: string; me: string }, actorId: string): Promise<SavePronounsResult> {
  const you = parsePronoun(input.you);
  const me = parsePronoun(input.me);
  if (!you.ok || !me.ok) return { ok: false, fieldErrors: { ...(you.ok ? {} : { you: you.error }), ...(me.ok ? {} : { me: me.error }) } };
  const next: Pronouns = { you: you.value, me: me.value };
  const before = await getPronouns();
  if (before.you === next.you && before.me === next.me) return { ok: true, pronouns: next };

  const row = await SystemSetting.findOneAndUpdate({ key: KEY }, { $set: { value: next } }, { upsert: true, returnDocument: "after" }).lean();
  await recordAudit({ actorId, action: "update", entity: "systemSetting", entityId: row._id.toString(), before: { key: KEY, value: before }, after: { key: KEY, value: next } });
  return { ok: true, pronouns: next };
}
