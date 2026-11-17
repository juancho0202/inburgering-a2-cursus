// What the recorded voice is given, for every line of the real course. The voice (Piper, through espeak) reads a sign
// it does not know by its name ("pijl naar rechts", "slash") and a word part like "be-" letter by letter: these checks
// catch that before anything is recorded. The sound itself is checked by `npm run voice` (scripts/tts/README.md).
import { describe, expect, it } from "vitest";
import { spokenLines } from "../../scripts/tts/lines";
import { speakable, voiceInput } from "../../src/lib/announce";
import { DUTCH_PHONEMES, ESPEAK_IS_RIGHT, PRONUNCIATIONS } from "../../shared/content/pronunciations";
import { realContent } from "../helpers/realContent";

/** Everything the course reads aloud: lesson lines and the lines of listening fragments. */
async function allLines(): Promise<string[]> {
  const { texts, fragments } = spokenLines(await realContent());
  return [...[...texts.values()].map((t) => t.text), ...[...fragments.values()].flatMap((f) => f.lines.map((l) => l.text))];
}

/** Letters, digits and the punctuation espeak turns into a pause; anything else it reads by name or not at all. */
const SAYABLE = /^[\p{L}\p{M}\p{N}\s.,!?:;'’"„“”…-]*$/u;
/** A word part as the grammar lessons write it: "-tje", "ge-". Not "groente- en fruit", where the hyphen saves a word. */
const WORD_PART = /(?<![\p{L}\p{N}-])-\p{L}+(?![\p{L}\p{N}-])|(?<![\p{L}\p{N}-])\p{L}+-(?![\p{L}\p{N}-])(?!\s+(?:en|of|tot)\s)/gu;

describe("what the recorded voice is given", () => {
  it("has no sign the voice would read by its name or skip", async () => {
    const lines = await allLines();
    const bad = lines.map((t) => speakable(t)).filter((t) => !SAYABLE.test(t));
    expect(bad, "handle the sign in saySigns (src/lib/announce.ts)").toEqual([]);
  });

  it("gives every word part a pronunciation, so it is not spelled or stressed like a word", async () => {
    const lines = await allLines();
    const missing = new Set(lines.flatMap((t) => (speakable(t).match(WORD_PART) ?? []).map((w) => w.toLowerCase())).filter((w) => !(w in PRONUNCIATIONS)));
    expect([...missing], "add them to PRONUNCIATIONS (shared/content/pronunciations.ts)").toEqual([]);
  });

  it("is the same when made twice, because the clip name is made from it", async () => {
    for (const t of await allLines()) expect(speakable(speakable(t))).toBe(speakable(t));
  });

  it("puts every pronunciation in, and leaves no word part outside [[ ]]", async () => {
    const used = new Set<string>();
    for (const t of await allLines()) {
      const input = voiceInput(t);
      for (const [, ipa] of input.matchAll(/\[\[([^\]]*)\]\]/g)) used.add(ipa);
      expect(input.replace(/\[\[[^\]]*\]\]/g, "").match(WORD_PART) ?? [], input).toEqual([]);
    }
    // the word parts in the grammar lessons are all said with their pronunciation
    for (const part of ["-tje", "be-", "ver-", "-en"]) expect(used).toContain(PRONUNCIATIONS[part]);
  });
});

describe("the pronunciations", () => {
  it("are written in lower case, with only the phonemes the voices know", () => {
    for (const [word, ipa] of Object.entries(PRONUNCIATIONS)) {
      expect(word, word).toBe(word.toLowerCase());
      expect([...ipa].filter((c) => !DUTCH_PHONEMES.includes(c)), `${word}: ${ipa}`).toEqual([]);
      // one main stress per word; a stress mark goes before a syllable, never at the end
      for (const w of ipa.split(" ")) expect((w.match(/ˈ/g) ?? []).length, `${word}: ${ipa}`).toBeLessThanOrEqual(1);
      expect(ipa, word).not.toMatch(/[ˈˌ]$|^ː/);
    }
  });

  it("do not also count a word as right as espeak says it", () => {
    for (const word of ESPEAK_IS_RIGHT) {
      expect(word).toBe(word.toLowerCase());
      expect(PRONUNCIATIONS, word).not.toHaveProperty(word);
    }
  });
});
