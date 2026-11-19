import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import en from "./en.json";
import vi from "./vi.json";

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (typeof value !== "object" || value === null) return {};
  return Object.entries(value).reduce<Record<string, string>>(
    (acc, [key, child]) => ({ ...acc, ...flatten(child, prefix ? `${prefix}.${key}` : key) }),
    {},
  );
}

// ICU element types (see @formatjs/icu-messageformat-parser).
const ARGUMENT_TYPES = new Set([1, 2, 3, 4, 5, 6]); // argument, number, date, time, select, plural
const TAG = 8;

interface IcuElement {
  type: number;
  value?: string;
  options?: Record<string, { value: IcuElement[] }>;
  children?: IcuElement[];
}

function collect(elements: IcuElement[], found: Set<string>): void {
  for (const element of elements) {
    if (ARGUMENT_TYPES.has(element.type) && element.value) found.add(`{${element.value}}`);
    if (element.type === TAG && element.value) found.add(`<${element.value}>`);
    for (const option of Object.values(element.options ?? {})) collect(option.value, found);
    if (element.children) collect(element.children, found);
  }
}

/** Names of the {arguments} and <tags> a message uses. Also throws on invalid ICU syntax. */
function placeholders(message: string): string[] {
  const found = new Set<string>();
  collect(new IntlMessageFormat(message, "en").getAst() as IcuElement[], found);
  return [...found].sort();
}

const viFlat = flatten(vi);
const enFlat = flatten(en);

describe("messages", () => {
  it("vi and en define exactly the same keys", () => {
    const missingInEn = Object.keys(viFlat).filter((key) => !(key in enFlat));
    const missingInVi = Object.keys(enFlat).filter((key) => !(key in viFlat));
    expect(missingInEn, "keys missing in en.json").toEqual([]);
    expect(missingInVi, "keys missing in vi.json").toEqual([]);
  });

  it("has no empty message", () => {
    const empty = [...Object.entries(viFlat), ...Object.entries(enFlat)]
      .filter(([, message]) => message.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("is valid ICU message syntax in both languages", () => {
    const invalid = [...Object.entries(viFlat), ...Object.entries(enFlat)]
      .filter(([, message]) => {
        try {
          placeholders(message);
          return false;
        } catch {
          return true;
        }
      })
      .map(([key]) => key);
    expect(invalid).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const mismatched = Object.keys(viFlat)
      .filter((key) => key in enFlat)
      .filter(
        (key) =>
          JSON.stringify(placeholders(viFlat[key] ?? "")) !==
          JSON.stringify(placeholders(enFlat[key] ?? "")),
      );
    expect(mismatched).toEqual([]);
  });

  it("Vietnamese messages address the person with pronoun tokens, never a bare 'bạn' or 'tôi'", () => {
    // "bạn bè" (friends) is a noun, not a form of address.
    const bare = Object.entries(viFlat)
      .filter(([key]) => !key.startsWith("admin.pronouns."))
      .filter(([, message]) => /(?<![\p{L}])(bạn(?!\s+bè)|tôi)(?![\p{L}])/iu.test(message))
      .map(([key]) => key);
    expect(bare, "use [you], [You], [me] or [Me] (docs: .claude/rules/copy.md)").toEqual([]);
  });

  it("English messages hold no pronoun tokens", () => {
    const tokens = Object.entries(enFlat)
      .filter(([, message]) => /\[(you|me)\]/i.test(message))
      .map(([key]) => key);
    expect(tokens).toEqual([]);
  });
});
