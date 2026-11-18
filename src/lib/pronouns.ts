/**
 * How the app speaks in Vietnamese: what it calls the person (`you`) and what it calls itself (`me`). The admin picks the pair
 * (Settings > Cách xưng hô); the default is "bạn" and "tôi". Messages never contain the words themselves: they hold the tokens
 * `[you]` and `[me]`, swapped for the saved pair when the messages are loaded; capitals follow the position (see `applyPronounsToText`).
 * Pure code (no database): the admin form and the tests use it too.
 */

export interface Pronouns {
  /** What the app calls the person: "bạn", "anh", "cậu". */
  you: string;
  /** What the app calls itself: "tôi", "mình", "em". */
  me: string;
  /** The word is a proper name ("Bubu", "Huong"): always written with capitals, wherever it stands. */
  youIsName: boolean;
  meIsName: boolean;
}

export const DEFAULT_PRONOUNS: Pronouns = { you: "bạn", me: "tôi", youIsName: false, meIsName: false };

/** Quick picks shown in the admin form; any other pair can still be typed. */
export const PRONOUN_PRESETS: readonly Pronouns[] = [
  { you: "bạn", me: "tôi", youIsName: false, meIsName: false },
  { you: "bạn", me: "mình", youIsName: false, meIsName: false },
  { you: "cậu", me: "tớ", youIsName: false, meIsName: false },
  { you: "anh", me: "em", youIsName: false, meIsName: false },
  { you: "chị", me: "em", youIsName: false, meIsName: false },
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
const titleCase = (words: string) => words.split(" ").map(upperFirst).join(" ");

/** How one saved word is written: a proper name always with capitals (each word of it), anything else as saved, with capitals only when it starts a sentence. */
export function pronounWord(word: string, isName: boolean, startsSentence: boolean): string {
  if (isName) return titleCase(word);
  return startsSentence ? upperFirst(word) : word;
}

/** Text before a token ends a sentence (or there is none): at the very start, after . ! ? … and a space, or on a new line. */
const BEFORE_SENTENCE_START = /(?:^|[.!?…]\s+|\n\s*)$/;

/**
 * Swaps the tokens in one string. The saved words are lower case ("tôi"). A word that starts a sentence gets a capital first letter
 * ("Tôi") and one inside a sentence stays as saved, by position, whichever form the message used (`[me]` or `[Me]`). A proper name
 * ("Bubu") is written with capitals everywhere.
 */
export function applyPronounsToText(text: string, pronouns: Pronouns): string {
  return text.replace(/\[(you|me)\]/gi, (_token, kind: string, offset: number) => {
    const startsSentence = BEFORE_SENTENCE_START.test(text.slice(0, offset));
    return kind.toLowerCase() === "you" ? pronounWord(pronouns.you, pronouns.youIsName, startsSentence) : pronounWord(pronouns.me, pronouns.meIsName, startsSentence);
  });
}

type Tree = { [key: string]: Tree | string };

const memo = new Map<string, Tree>();

/**
 * A copy of the message tree with every token swapped. Kept per pair and per source, so the walk over the messages happens once
 * for each pair the app has used, not on every request.
 */
export function applyPronouns<T extends Tree>(messages: T, pronouns: Pronouns, sourceKey: string): T {
  const key = `${sourceKey}|${pronouns.you}|${pronouns.me}|${pronouns.youIsName}|${pronouns.meIsName}`;
  const known = memo.get(key);
  if (known) return known as T;
  const walk = (node: Tree): Tree =>
    Object.fromEntries(Object.entries(node).map(([name, value]) => [name, typeof value === "string" ? applyPronounsToText(value, pronouns) : walk(value)]));
  const result = walk(messages);
  memo.set(key, result);
  return result as T;
}
