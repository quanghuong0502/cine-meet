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

const PAIR = { ...DEFAULT_PRONOUNS };

describe("applyPronounsToText", () => {
  it("writes the saved word in lower case inside a sentence and with a capital when it starts one", () => {
    const text = "[you] đã chốt. [me] nhắc [you] nha, [me] hứa.";
    expect(applyPronounsToText(text, PAIR)).toBe("Bạn đã chốt. Tôi nhắc bạn nha, tôi hứa.");
    expect(applyPronounsToText(text, { ...PAIR, you: "anh", me: "em" })).toBe("Anh đã chốt. Em nhắc anh nha, em hứa.");
  });
  it("decides capitals by position, not by the form the message used", () => {
    const pair = { ...PAIR, you: "tôi", me: "tớ" };
    expect(applyPronounsToText("[you] đã chốt. [me] nhắc nha! [You] nhớ nhé? Cho [You] nè", pair)).toBe("Tôi đã chốt. Tớ nhắc nha! Tôi nhớ nhé? Cho tôi nè");
    expect(applyPronounsToText("[You] đã chốt.\n[me] nhắc nha", pair)).toBe("Tôi đã chốt.\nTớ nhắc nha");
    expect(applyPronounsToText("Gửi: [Me] hứa", pair)).toBe("Gửi: tớ hứa");
  });
  it("writes a proper name with capitals everywhere", () => {
    const pair = { you: "huong", me: "bubu", youIsName: true, meIsName: true };
    expect(applyPronounsToText("Chào [you]! [me] đây. Hỏi [me] nha, [you] ơi", pair)).toBe("Chào Huong! Bubu đây. Hỏi Bubu nha, Huong ơi");
    expect(applyPronounsToText("nhắc [me]", { ...pair, me: "quang huong" })).toBe("nhắc Quang Huong");
  });
  it("leaves 'bạn bè' and other text alone", () => {
    expect(applyPronounsToText("Mời bạn bè", { ...PAIR, you: "anh", me: "em" })).toBe("Mời bạn bè");
  });
});

describe("applyPronouns", () => {
  it("swaps inside nested messages without touching the original", () => {
    const source = { a: { b: "[You] ơi" }, c: "[me]" };
    const out = applyPronouns(source, { ...PAIR, you: "cậu", me: "tớ" }, "test");
    expect(out).toEqual({ a: { b: "Cậu ơi" }, c: "Tớ" });
    expect(source.a.b).toBe("[You] ơi");
  });
});
