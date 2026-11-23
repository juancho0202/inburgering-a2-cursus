// The sentence deck at the end of a taalcafé word level: which sentences become cards, and what the answer is.
import { describe, expect, it } from "vitest";
import { DECK_MAX_CARDS, DECK_MAX_WORDS, buildDeck, rightFromStart } from "../../shared/logic/taalcafeDeck";

const fix = (original: string, corrected: string, explanation = "uitleg") => ({ original, corrected, type: "werkwoord", explanation });

describe("buildDeck", () => {
  it("makes one card per corrected sentence: the learner's sentence with the wrong part, and the corrected words in order", () => {
    const deck = buildDeck([{ text: "Hoi! Zaterdag ik heb gaan naar de markt. Het was leuk.", corrections: [fix("ik heb gaan", "ben ik gegaan", "Gaan krijgt zijn.")] }]);
    expect(deck).toEqual([
      { original: "Zaterdag ik heb gaan naar de markt.", wrong: ["ik heb gaan"], tokens: ["Zaterdag", "ben", "ik", "gegaan", "naar", "de", "markt"], explanations: ["Gaan krijgt zijn."] },
    ]);
  });

  it("puts two corrections in one sentence on one card, and leaves out sentences without a correction and messages without corrections", () => {
    const deck = buildDeck([
      { text: "Ik woon in de huis. Ik heb een kat.", corrections: [fix("de huis", "het huis"), fix("woon in", "woon in", "x")] },
      { text: "Alles goed.", corrections: [] },
      { text: "Ik werkt bij de bakker", corrections: [fix("Ik werkt", "Ik werk", "a"), fix("de bakker", "een bakker", "b")] },
    ]);
    expect(deck.map((c) => c.tokens.join(" "))).toEqual(["Ik woon in het huis", "Ik werk bij een bakker"]);
    expect(deck[1].explanations).toEqual(["a", "b"]);
    expect(deck[1].wrong).toEqual(["Ik werkt", "de bakker"]);
  });

  it("a sentence of more words is cut down to the words around the correction", () => {
    const text = "Vorige week op zaterdag in de ochtend heel vroeg ik heb gaan met mijn broer en zijn vrouw naar de grote markt";
    const [card] = buildDeck([{ text, corrections: [fix("ik heb gaan", "ben ik gegaan")] }]);
    expect(card.tokens).toHaveLength(DECK_MAX_WORDS);
    expect(card.tokens.join(" ")).toContain("ben ik gegaan");
    expect(card.tokens.indexOf("ben")).toBeLessThanOrEqual(3);
  });

  it("skips one-word cards and the same sentence twice, and deals at most a handful of cards", () => {
    expect(buildDeck([{ text: "Werkt.", corrections: [fix("Werkt", "Werk")] }])).toEqual([]);
    const same = { text: "Ik heb gaan.", corrections: [fix("Ik heb gaan", "Ik ben gegaan")] };
    expect(buildDeck([same, same])).toHaveLength(1);
    const many = Array.from({ length: 10 }, (_, i) => ({ text: `Ik heb gaan ${i}.`, corrections: [fix("Ik heb gaan", "Ik ben gegaan")] }));
    expect(buildDeck(many)).toHaveLength(DECK_MAX_CARDS);
  });
});

describe("rightFromStart", () => {
  it("counts the words in the right place from the start, up to the first mistake", () => {
    expect(rightFromStart(["Ik", "ben", "gegaan"], ["Ik", "ben", "gegaan"])).toBe(3);
    expect(rightFromStart(["Ik", "gegaan", "ben"], ["Ik", "ben", "gegaan"])).toBe(1);
    expect(rightFromStart(["ben", "Ik", "gegaan"], ["Ik", "ben", "gegaan"])).toBe(0);
  });
});
