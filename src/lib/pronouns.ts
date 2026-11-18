/**
 * How the app speaks in Vietnamese: what it calls the person (`you`) and what it calls itself (`me`). The admin picks the pair
 * (Settings > Cách xưng hô); the default is "bạn" and "tôi". Messages never contain the words themselves: they hold the tokens
 * `[you]` and `[me]` (`[You]` and `[Me]` at the start of a sentence), swapped for the saved pair when the messages are loaded.
 * Pure code (no database): the admin form and the tests use it too.
 */

export interface Pronouns {
  /** What the app calls the person: "bạn", "anh", "cậu". */
  you: string;
  /** What the app calls itself: "tôi", "mình", "em". */
  me: string;
}

export const DEFAULT_PRONOUNS: Pronouns = { you: "bạn", me: "tôi" };

/** Quick picks shown in the admin form; any other pair can still be typed. */
export const PRONOUN_PRESETS: readonly Pronouns[] = [
  { you: "bạn", me: "tôi" },
  { you: "bạn", me: "mình" },
  { you: "cậu", me: "tớ" },
  { you: "anh", me: "em" },
  { you: "chị", me: "em" },
];

export const MAX_PRONOUN_LENGTH = 12;

export type PronounError = "required" | "too_long" | "invalid";

/** One word of address: letters (with Vietnamese marks) and single spaces between them, up to 12 characters. Returns the cleaned word or the reason it is refused. */
export function parsePronoun(raw: string): { ok: true; value: string } | { ok: false; error: PronounError } {
  const value = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (value === "") return { ok: false, error: "required" };
  if (value.length > MAX_PRONOUN_LENGTH) return { ok: false, error: "too_long" };
  if (!/^\p{L}+( \p{L}+)*$/u.test(value)) return { ok: false, error: "invalid" };
  return { ok: true, value };
}

const upperFirst = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A token that starts a sentence: at the very start, after . ! ? … and a space, or on a new line. */
const SENTENCE_START = /(^|[.!?…]\s+|\n\s*)\[(you|me)\]/gi;

/**
 * Swaps the tokens in one string. The saved words are lower case ("tôi"); a word that starts a sentence gets its first letter in
 * capitals ("Tôi") by position, whichever form the message used (`[me]` or `[Me]`). `[You]` and `[Me]` also force capitals elsewhere
 * (after a colon, at the start of a label).
 */
export function applyPronounsToText(text: string, pronouns: Pronouns): string {
  const word = (kind: string) => (kind.toLowerCase() === "you" ? pronouns.you : pronouns.me);
  return text
    .replace(SENTENCE_START, (_whole, lead: string, kind: string) => `${lead}${upperFirst(word(kind))}`)
    .replaceAll("[You]", upperFirst(pronouns.you))
    .replaceAll("[you]", pronouns.you)
    .replaceAll("[Me]", upperFirst(pronouns.me))
    .replaceAll("[me]", pronouns.me);
}

type Tree = { [key: string]: Tree | string };

const memo = new Map<string, Tree>();

/**
 * A copy of the message tree with every token swapped. Kept per pair and per source, so the walk over the messages happens once
 * for each pair the app has used, not on every request.
 */
export function applyPronouns<T extends Tree>(messages: T, pronouns: Pronouns, sourceKey: string): T {
  const key = `${sourceKey}|${pronouns.you}|${pronouns.me}`;
  const known = memo.get(key);
  if (known) return known as T;
  const walk = (node: Tree): Tree =>
    Object.fromEntries(Object.entries(node).map(([name, value]) => [name, typeof value === "string" ? applyPronounsToText(value, pronouns) : walk(value)]));
  const result = walk(messages);
  memo.set(key, result);
  return result as T;
}
