import { describe, expect, it } from "vitest";
import { applyPronouns, applyPronounsToText, DEFAULT_PRONOUNS, parsePronoun } from "./pronouns";

describe("parsePronoun", () => {
  it("cleans and accepts a word of address", () => {
    expect(parsePronoun("  Anh ")).toEqual({ ok: true, value: "anh" });
    expect(parsePronoun("anh   trai")).toEqual({ ok: true, value: "anh trai" });
    expect(parsePronoun("tớ")).toEqual({ ok: true, value: "tớ" });
  });
  it("refuses empty, too long and non-letter input", () => {
    expect(parsePronoun("   ")).toEqual({ ok: false, error: "required" });
    expect(parsePronoun("a".repeat(13))).toEqual({ ok: false, error: "too_long" });
    expect(parsePronoun("b4n")).toEqual({ ok: false, error: "invalid" });
    expect(parsePronoun("[you]")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("applyPronounsToText", () => {
  it("swaps the tokens, capital form at the start of a sentence", () => {
    const text = "[You] đã chốt. [Me] nhắc [you] nha, [me] hứa.";
    expect(applyPronounsToText(text, DEFAULT_PRONOUNS)).toBe("Bạn đã chốt. Tôi nhắc bạn nha, tôi hứa.");
    expect(applyPronounsToText(text, { you: "anh", me: "em" })).toBe("Anh đã chốt. Em nhắc anh nha, em hứa.");
  });
  it("leaves 'bạn bè' and other text alone", () => {
    expect(applyPronounsToText("Mời bạn bè", { you: "anh", me: "em" })).toBe("Mời bạn bè");
  });
});

describe("applyPronouns", () => {
  it("swaps inside nested messages without touching the original", () => {
    const source = { a: { b: "[You] ơi" }, c: "[me]" };
    const out = applyPronouns(source, { you: "cậu", me: "tớ" }, "test");
    expect(out).toEqual({ a: { b: "Cậu ơi" }, c: "tớ" });
    expect(source.a.b).toBe("[You] ơi");
  });
});
