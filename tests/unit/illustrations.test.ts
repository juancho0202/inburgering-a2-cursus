import { afterEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "@shared/types";
import { scene, spotFor, warmImages } from "../../src/lib/illustrations";

const mc = (id: string, prompt: string, extra: Partial<Exercise> = {}): Exercise =>
  ({ id, tags: [], explanation: "e", difficulty: 1, type: "mc", prompt, options: ["a", "b"], answer: 0, ...extra }) as Exercise;
const gap = (id: string, prompt: string, text: string, tags: string[] = []): Exercise =>
  ({ id, tags, explanation: "e", difficulty: 1, type: "gap-fill", prompt, text, answers: [["x"]] }) as Exercise;
const alt = (e: Exercise) => spotFor(e)?.alt;
const PEOPLE = ["Een vrouw legt iets uit.", "Een man heeft een idee.", "Een vrouw denkt na.", "Een man wijst iets aan.", "Een man leest een papier.", "Een vrouw werkt op een laptop."];

describe("illustrations", () => {
  it("finds a scene with its alt text, and nothing for an unknown id", () => {
    expect(scene("keuken")?.alt).toContain("koffie");
    expect(scene("bestaat-niet")).toBeNull();
    expect(scene(undefined)).toBeNull();
  });

  it("uses the drawing the course names", () => {
    expect(alt(mc("x-1", "Wat is kwart over acht?", { spot: "hond" }))).toBe("Een hond.");
  });

  it("shows what the question is about", () => {
    expect(alt(mc("a", "Wat is kwart over acht?"))).toBe("Een klok.");
    expect(alt(mc("b", "Er is brand in het huis. Wat bel je?"))).toBe("Een telefoon.");
    expect(alt(mc("c", "De huisarts geeft Sanne een recept. Waar haalt ze het medicijn?"))).toBe("Medicijnen.");
    expect(alt(mc("d", "Ahmed wilde zaterdag verhuizen, maar de huisbaas zei nee."))).toBe("Een verhuisdoos.");
  });

  it("searches the prompt before the rest of the question", () => {
    expect(alt({ ...mc("e", "Schrijf een e-mail aan de huisarts."), context: "Je bent ziek." } as Exercise)).toBe("Een laptop.");
  });

  it("never points at an answer option, also not in a list in brackets", () => {
    expect(alt(mc("f", "Waar ga je naartoe?", { options: ["Naar de huisarts", "Naar de bakker"] } as Partial<Exercise>))).not.toBe("Een dokter.");
    expect(PEOPLE).toContain(alt(gap("g", "Vul de infinitief in (komen, werken, bellen).", "Ik kan morgen niet ___ .")));
  });

  it("counts days and dates only in the prompt, not in a grammar sentence", () => {
    expect(alt(mc("h", "Welke feestdag is op 27 april?"))).toBe("Een kalender.");
    expect(PEOPLE).toContain(alt(gap("i", "Kies de goede vorm.", "Ik ___ morgen werken.")));
  });

  it("falls back to the topic, and to people for grammar", () => {
    expect(alt(mc("j", "Wat is een borg?", { tags: ["knm:wonen"] }))).toBe("Een Nederlands huis.");
    expect(PEOPLE).toContain(alt(mc("k", "Kies de goede vorm.", { tags: ["grammar:zinsbouw"] })));
  });

  it("is always the same for the same question, on both sides", () => {
    const e = mc("knm-wonen-q-001", "Wat is een borg?", { tags: ["knm:wonen"] });
    expect(spotFor(e)).toEqual(spotFor(e));
    const sides = new Set(Array.from({ length: 20 }, (_, i) => spotFor(mc(`q-${i}`, "Kies."))?.side));
    expect(sides).toEqual(new Set(["left", "right"]));
  });
});

describe("warming up pictures", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("works in a browser without Image.decode (older phones): the picture is still requested", () => {
    const made: { src: string }[] = [];
    vi.stubGlobal("Image", class { src = ""; decoding = ""; constructor() { made.push(this); } });
    expect(() => warmImages(["/a.svg", "/b.svg", "/a.svg"])).not.toThrow();
    expect(made.map((i) => i.src)).toEqual(["/a.svg", "/b.svg"]);
  });
});
