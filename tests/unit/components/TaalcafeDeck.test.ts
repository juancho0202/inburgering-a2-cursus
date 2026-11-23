// @vitest-environment jsdom
// The sentence deck at the end of a taalcafé word level: put the corrected sentence in order, card by card.
import { afterEach, describe, expect, it, vi } from "vitest";
import TaalcafeDeck from "../../../src/components/TaalcafeDeck.vue";
import type { DeckCard } from "../../../shared/logic/taalcafeDeck";
import { buttonWith, clickButton, mountApp } from "../../helpers/component";

const CARDS: DeckCard[] = [
  { original: "Zaterdag ik heb gaan.", wrong: ["ik heb gaan"], tokens: ["Zaterdag", "ben", "ik", "gegaan"], explanations: ["Gaan krijgt zijn."] },
  { original: "Ik woon in de huis.", wrong: ["de huis"], tokens: ["Ik", "woon", "in", "het", "huis"], explanations: ["Huis is een het-woord."] },
];
type W = Awaited<ReturnType<typeof mountApp>>["wrapper"];
const pool = (w: W) => w.find("[data-pool]").findAll("button");
const answer = (w: W) => w.find("[data-answer]").findAll("button").map((b) => b.text());
async function tap(w: W, words: string[]) {
  for (const word of words) await pool(w).find((b) => b.text() === word)!.trigger("click");
}
async function open(cards = CARDS) {
  const { wrapper } = await mountApp(TaalcafeDeck, { props: { cards } });
  return wrapper;
}
afterEach(() => vi.restoreAllMocks());
afterEach(() => document.body.querySelectorAll("[role=dialog]").forEach((d) => d.remove()));

describe("TaalcafeDeck", () => {
  it("shows the first card: the learner's sentence with the wrong part struck, and its words mixed up", async () => {
    const w = await open();
    expect(w.find("[role=dialog]").attributes("aria-modal")).toBe("true");
    expect(w.text()).toContain("Kaart 1 van 2");
    expect(w.find("[data-original] del").text()).toBe("ik heb gaan");
    expect(pool(w).map((b) => b.text()).sort()).toEqual(["Zaterdag", "ben", "gegaan", "ik"]);
    expect(pool(w).map((b) => b.text())).not.toEqual(CARDS[0].tokens); // never dealt in order
    expect(document.activeElement).toBe(w.find("[data-deck]").element);
  });

  it("a shuffle that comes out in the right order is dealt again", async () => {
    // The first shuffle of four words takes three random numbers; 0.999 swaps nothing, so it would be in order.
    let n = 0;
    vi.spyOn(Math, "random").mockImplementation(() => (n++ < 3 ? 0.999 : 0));
    const w = await open();
    expect(pool(w).map((b) => b.text())).not.toEqual(CARDS[0].tokens);
  });

  it("checks only once every word is placed; a tapped word goes back; a wrong order keeps the right start and returns the rest", async () => {
    const w = await open();
    await tap(w, ["Zaterdag", "ik"]);
    expect(buttonWith(w, "Controleer")!.attributes("disabled")).toBeDefined();
    await w.find("[data-answer]").findAll("button")[1].trigger("click"); // "ik" back
    expect(answer(w)).toEqual(["Zaterdag"]);
    await tap(w, ["ik", "ben", "gegaan"]);
    await clickButton(w, "Controleer");
    expect(w.text()).toContain("Nog niet goed.");
    expect(answer(w)).toEqual(["Zaterdag"]);
    expect(pool(w).map((b) => b.text()).sort()).toEqual(["ben", "gegaan", "ik"]);
    expect(buttonWith(w, "Volgende kaart")).toBeUndefined();
  });

  it("the right order: 'Goed!' with the explanation, then the next card; the last card ends the deck", async () => {
    const w = await open();
    await tap(w, ["Zaterdag", "ben", "ik", "gegaan"]);
    await clickButton(w, "Controleer");
    expect(w.text()).toContain("Goed! Zo zeg je het.");
    expect(w.text()).toContain("Gaan krijgt zijn.");
    expect(document.activeElement).toBe(buttonWith(w, "Volgende kaart")!.element);
    // Locked once right: tapping a word changes nothing
    await w.find("[data-answer]").findAll("button")[0].trigger("click");
    expect(answer(w)).toEqual(["Zaterdag", "ben", "ik", "gegaan"]);

    await clickButton(w, "Volgende kaart");
    expect(w.text()).toContain("Kaart 2 van 2");
    expect(answer(w)).toEqual([]);
    expect(w.emitted("done")).toBeUndefined();
    await tap(w, ["Ik", "woon", "in", "het", "huis"]);
    await clickButton(w, "Controleer");
    await clickButton(w, "Klaar");
    expect(w.emitted("done")).toHaveLength(1);
  });

  it("✕ and Escape close the deck without finishing it", async () => {
    const w = await open();
    await w.find("button[aria-label=Sluiten]").trigger("click");
    await w.find("[role=dialog]").trigger("keydown", { key: "Escape" });
    expect(w.emitted("close")).toHaveLength(2);
    expect(w.emitted("done")).toBeUndefined();
  });
});
