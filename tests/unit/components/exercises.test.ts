// @vitest-environment jsdom
// What each exercise type tells the shell: when "Controleer" may be pressed (ready) and how the answer is
// judged (evaluate). Driven through the screen (clicks, typing, keys), not through internal state.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import McExercise from "../../../src/components/exercises/McExercise.vue";
import TrueFalseExercise from "../../../src/components/exercises/TrueFalseExercise.vue";
import GapFillExercise from "../../../src/components/exercises/GapFillExercise.vue";
import ConjugateExercise from "../../../src/components/exercises/ConjugateExercise.vue";
import WordOrderExercise from "../../../src/components/exercises/WordOrderExercise.vue";
import MatchExercise from "../../../src/components/exercises/MatchExercise.vue";
import FormFillExercise from "../../../src/components/exercises/FormFillExercise.vue";
import ReadingExercise from "../../../src/components/exercises/ReadingExercise.vue";
import { fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const base = { tags: ["t"], prompt: "Vraag", explanation: "Uitleg", difficulty: 1 as const };
const mount = (component: any, exercise: unknown, extra: Record<string, unknown> = {}) =>
  mountApp(component, { props: { exercise, checked: false, ...extra } }).then((m) => m.wrapper);
type Handle = { ready: boolean; evaluate: () => any };
const handle = (w: VueWrapper) => w.vm as unknown as Handle;
const byText = (w: VueWrapper, selector: string, text: string) => {
  const el = w.findAll(selector).find((e) => e.text().replace(/^\d\s*/, "") === text);
  if (!el) throw new Error(`No ${selector} with text "${text}"`);
  return el;
};
const option = (w: VueWrapper, label: string) => w.findAll("button").find((b) => b.text().replace(/^\d/, "") === label)!;

beforeEach(() => fakeApi.reset());
afterEach(() => vi.restoreAllMocks());

describe("McExercise (mc, mc-multi)", () => {
  const mc = { ...base, id: "q1", type: "mc", options: ["Amsterdam", "Utrecht", "Rotterdam"], answer: 0 };
  const multi = { ...base, id: "q2", type: "mc-multi", options: ["a", "b", "c", "d"], answers: [1, 3] };

  it("is ready after choosing, and choosing another option replaces the first", async () => {
    const w = await mount(McExercise, mc);
    expect(handle(w).ready).toBe(false);
    await option(w, "Utrecht").trigger("click");
    await option(w, "Amsterdam").trigger("click");
    expect(handle(w).ready).toBe(true);
    expect(handle(w).evaluate()).toMatchObject({ correct: true, score: 1, answer: 0 });
  });

  it("marks a wrong choice wrong and reports the right answer text", async () => {
    const w = await mount(McExercise, mc);
    await option(w, "Rotterdam").trigger("click");
    expect(handle(w).evaluate()).toMatchObject({ correct: false, score: 0, answer: 2, correctAnswer: "Amsterdam" });
  });

  it("keeps the learner's answer pointing at the original option even though the display order is shuffled", async () => {
    // the answer index stored in progress must refer to exercise.options, never to the shuffled position
    for (let n = 0; n < 5; n++) {
      const w = await mount(McExercise, mc);
      await option(w, "Rotterdam").trigger("click");
      expect(handle(w).evaluate().answer).toBe(2);
    }
  });

  it("the number key shown next to an option selects that option", async () => {
    const w = await mount(McExercise, mc);
    const target = w.findAll("button").find((b) => b.text().endsWith("Utrecht"))!;
    await pressKey(target.text().match(/^(\d)/)![1]);
    expect(handle(w).evaluate().answer).toBe(1);
  });

  it("does not use number keys when keys are switched off (several questions on one page)", async () => {
    const w = await mount(McExercise, mc, { keys: false });
    await pressKey("1");
    expect(handle(w).ready).toBe(false);
  });

  it("locks the answer once it has been checked", async () => {
    const w = await mount(McExercise, mc, { checked: true });
    await option(w, "Utrecht").trigger("click");
    expect(handle(w).ready).toBe(false);
  });

  it("mc-multi needs exactly the right set: a missing or an extra option is wrong", async () => {
    const w = await mount(McExercise, multi);
    await option(w, "b").trigger("click");
    expect(handle(w).evaluate().correct).toBe(false); // one of two
    await option(w, "d").trigger("click");
    expect(handle(w).evaluate()).toMatchObject({ correct: true, answer: [1, 3], correctAnswer: "b + d" });
    await option(w, "a").trigger("click");
    expect(handle(w).evaluate().correct).toBe(false); // right ones plus an extra
    await option(w, "a").trigger("click"); // toggles off again
    expect(handle(w).evaluate().correct).toBe(true);
  });

  it("exam mode: starts from the saved selection, keeps the option order and reports every change", async () => {
    const w = await mount(McExercise, mc, { initial: [1], shuffle: false });
    expect(w.findAll("button").map((b) => b.text().replace(/^\d/, ""))).toEqual(["Amsterdam", "Utrecht", "Rotterdam"]);
    expect(option(w, "Utrecht").attributes("aria-pressed")).toBe("true");
    await option(w, "Rotterdam").trigger("click");
    expect(w.emitted("change")!.at(-1)).toEqual([[2]]);
  });
});

describe("TrueFalseExercise", () => {
  const tf = { ...base, id: "q", type: "true-false", statement: "Nederland ligt in Europa.", answer: true };

  it("judges the choice and names the right answer", async () => {
    const w = await mount(TrueFalseExercise, tf);
    expect(handle(w).ready).toBe(false);
    await byText(w, "button", "Klopt niet").trigger("click");
    expect(handle(w).evaluate()).toMatchObject({ correct: false, answer: false, correctAnswer: "Klopt" });
    await byText(w, "button", "Klopt").trigger("click");
    expect(handle(w).evaluate()).toMatchObject({ correct: true, score: 1 });
  });

  it("key 1 = Klopt, key 2 = Klopt niet; no keys when switched off", async () => {
    const w = await mount(TrueFalseExercise, tf);
    await pressKey("2");
    expect(handle(w).evaluate().answer).toBe(false);
    await pressKey("1");
    expect(handle(w).evaluate().answer).toBe(true);
    const off = await mount(TrueFalseExercise, tf, { keys: false });
    await pressKey("1");
    expect(handle(off).ready).toBe(false);
  });
});

describe("GapFillExercise", () => {
  it("accepts any listed answer, ignoring case, accents and extra spaces, and needs every gap right", async () => {
    const ex = { ...base, id: "g", type: "gap-fill", text: "Ik ___ naar ___.", answers: [["ga", "loop"], ["school"]] };
    const w = await mount(GapFillExercise, ex);
    const [first, second] = w.findAll("input");
    expect(handle(w).ready).toBe(false);
    await first.setValue("  LOOP ");
    expect(handle(w).ready).toBe(false); // second gap still empty
    await second.setValue("schóol");
    expect(handle(w).ready).toBe(true);
    expect(handle(w).evaluate()).toMatchObject({ correct: true, score: 1, answer: ["  LOOP ", "schóol"], correctAnswer: "ga, school" });
    await second.setValue("huis");
    expect(handle(w).evaluate().correct).toBe(false);
  });

  it("gap-choice: judges the chosen option of each gap, not its position", async () => {
    const ex = { ...base, id: "g2", type: "gap-choice", text: "___ huis en ___ boom", options: [["de", "het"], ["de", "het"]], answers: [1, 0] };
    const w = await mount(GapFillExercise, ex);
    const [a, b] = w.findAll("select");
    await a.setValue("het");
    expect(handle(w).ready).toBe(false);
    await b.setValue("het");
    expect(handle(w).evaluate()).toMatchObject({ correct: false, correctAnswer: "het, de" });
    await b.setValue("de");
    expect(handle(w).evaluate().correct).toBe(true);
  });
});

describe("ConjugateExercise", () => {
  const verbs = [
    { id: "gaan", infinitive: "gaan", auxiliary: "zijn", state: "new" },
    { id: "werken", infinitive: "werken", auxiliary: "hebben", state: "new" },
    { id: "vliegen", infinitive: "vliegen", auxiliary: "both", state: "new" },
  ];
  const ex = (verbId: string, tense: string, answers: string[]) => ({ ...base, id: `c-${verbId}-${tense}`, type: "conjugate", verbId, tense, person: "ik", answers });
  beforeEach(() => fakeApi.on("GET", "/verbs", verbs));

  it("present tense: only the form counts", async () => {
    const w = await mount(ConjugateExercise, ex("werken", "present", ["werk"]));
    expect(handle(w).ready).toBe(false);
    await w.find("input").setValue("Werk");
    expect(handle(w).ready).toBe(true);
    expect(handle(w).evaluate()).toMatchObject({ correct: true, correctAnswer: "werk" });
  });

  it("perfect tense: the participle is right but the wrong hebben/zijn is still wrong", async () => {
    const w = await mount(ConjugateExercise, ex("gaan", "perfect", ["gegaan"]));
    await w.find("input").setValue("gegaan");
    expect(handle(w).ready).toBe(false); // hebben/zijn not chosen yet
    await w.find("select").setValue("hebben");
    expect(handle(w).evaluate()).toMatchObject({ correct: false, correctAnswer: "zijn gegaan" });
    await w.find("select").setValue("zijn");
    expect(handle(w).evaluate().correct).toBe(true);
  });

  it("perfect tense of a verb that takes both: either auxiliary is fine, and none is named in the answer", async () => {
    const w = await mount(ConjugateExercise, ex("vliegen", "perfect", ["gevlogen"]));
    await w.find("input").setValue("gevlogen");
    await w.find("select").setValue("hebben");
    expect(handle(w).evaluate()).toMatchObject({ correct: true, correctAnswer: "gevlogen" });
  });

  it("is not answerable until the verb list has loaded", async () => {
    let release!: (v: unknown) => void;
    fakeApi.on("GET", "/verbs", () => new Promise((r) => (release = r)));
    const w = await mount(ConjugateExercise, ex("werken", "present", ["werk"]));
    expect(w.find("input").exists()).toBe(false);
    expect(handle(w).ready).toBe(false);
    release(verbs);
    await flushPromises();
    expect(w.find("input").exists()).toBe(true);
  });
});

describe("WordOrderExercise", () => {
  const ex = { ...base, id: "w", type: "word-order", tokens: ["Ik", "werk", "vandaag"], alsoAccepted: [["vandaag", "werk", "Ik"]] };
  const texts = (w: VueWrapper, area: string) => w.find(`[aria-label='${area}']`).findAll("button").map((b) => b.text());
  const tap = (w: VueWrapper, area: "Woorden" | "Jouw zin", text: string) => w.find(`[aria-label='${area}']`).findAll("button").find((b) => b.text() === text)!.trigger("click");

  it("moves words between the pool and the sentence, and is ready only when every word is used", async () => {
    const w = await mount(WordOrderExercise, ex);
    expect(texts(w, "Woorden").sort()).toEqual(["Ik", "vandaag", "werk"]);
    await tap(w, "Woorden", "Ik");
    await tap(w, "Woorden", "werk");
    expect(texts(w, "Jouw zin")).toEqual(["Ik", "werk"]);
    expect(handle(w).ready).toBe(false);
    await tap(w, "Jouw zin", "werk"); // take it back
    expect(texts(w, "Woorden")).toContain("werk");
    await tap(w, "Woorden", "werk");
    await tap(w, "Woorden", "vandaag");
    expect(handle(w).ready).toBe(true);
  });

  it("accepts the main order and a listed alternative, but not other orders", async () => {
    const wrong = await mount(WordOrderExercise, ex);
    for (const t of ["werk", "Ik", "vandaag"]) await tap(wrong, "Woorden", t);
    expect(handle(wrong).evaluate()).toMatchObject({ correct: false, answer: ["werk", "Ik", "vandaag"], correctAnswer: "Ik werk vandaag" });

    const ok = await mount(WordOrderExercise, ex);
    for (const t of ["Ik", "werk", "vandaag"]) await tap(ok, "Woorden", t);
    expect(handle(ok).evaluate().correct).toBe(true);

    const alt = await mount(WordOrderExercise, ex);
    for (const t of ["vandaag", "werk", "Ik"]) await tap(alt, "Woorden", t);
    expect(handle(alt).evaluate().correct).toBe(true);
  });

  it("never starts with the words already in the right order", async () => {
    // the first shuffle happens to give the solved order (random 0.99 keeps every element in place), the next one swaps
    const two = { ...ex, tokens: ["Ja", "hoor"], alsoAccepted: [] };
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99).mockReturnValue(0);
    const w = await mount(WordOrderExercise, two);
    expect(texts(w, "Woorden")).toEqual(["hoor", "Ja"]);
  });

  it("locks the words once checked", async () => {
    const w = await mount(WordOrderExercise, ex, { checked: true });
    await w.find("[aria-label='Woorden']").findAll("button")[0].trigger("click");
    expect(texts(w, "Woorden")).toHaveLength(3);
  });
});

describe("MatchExercise", () => {
  const ex = { ...base, id: "m", type: "match", pairs: [["huis", "house"], ["boom", "tree"], ["fiets", "bike"]] };
  const column = (w: VueWrapper, which: "left" | "right") => w.findAll(".grid.grid-cols-2 > div")[which === "left" ? 0 : 1];
  const side = (w: VueWrapper, which: "left" | "right", text: string) =>
    column(w, which).findAll("button").find((b) => b.text().replace(/^\d+/, "").trim() === text)!;
  const link = async (w: VueWrapper, l: string, r: string) => {
    await side(w, "left", l).trigger("click");
    await side(w, "right", r).trigger("click");
  };

  it("is ready when every left word is linked, and correct only when every link is right", async () => {
    const w = await mount(MatchExercise, ex);
    await link(w, "huis", "house");
    await link(w, "boom", "bike");
    expect(handle(w).ready).toBe(false);
    await link(w, "fiets", "tree");
    expect(handle(w).ready).toBe(true);
    expect(handle(w).evaluate()).toMatchObject({ correct: false, correctAnswer: "huis = house; boom = tree; fiets = bike" });
    await link(w, "boom", "tree"); // "tree" was taken by fiets: that link is dropped, boom now owns it
    expect(handle(w).ready).toBe(false);
    await link(w, "fiets", "bike");
    expect(handle(w).evaluate()).toMatchObject({ correct: true, score: 1, answer: { 0: 0, 1: 1, 2: 2 } });
  });

  it("clicking a linked word removes its link", async () => {
    const w = await mount(MatchExercise, ex);
    await link(w, "huis", "house");
    await link(w, "boom", "tree");
    await link(w, "fiets", "bike");
    expect(handle(w).ready).toBe(true);
    await side(w, "left", "boom").trigger("click");
    expect(handle(w).ready).toBe(false);
  });

  it("a right-hand word does nothing until a left word has been chosen", async () => {
    const w = await mount(MatchExercise, ex);
    await side(w, "right", "house").trigger("click");
    await side(w, "left", "boom").trigger("click");
    await side(w, "right", "tree").trigger("click");
    expect(handle(w).evaluate().answer).toEqual({ 1: 1 });
  });
});

describe("FormFillExercise", () => {
  const field = (label: string, expected?: string) => ({ label, hint: "", ...(expected === undefined ? {} : { expected }) });
  const ex = (fields: unknown[]) => ({ ...base, id: "f", type: "form-fill", scenario: "Je verhuist.", formTitle: "Aanmelding", fields });

  it("scores the share of checked fields that are right; unchecked fields never count", async () => {
    const w = await mount(FormFillExercise, ex([field("Naam", "Jan"), field("Plaats", "Utrecht"), field("Opmerking")]));
    expect(handle(w).ready).toBe(false);
    const [naam, plaats, opm] = w.findAll("input");
    await naam.setValue("jan");
    await plaats.setValue("Zeist");
    await opm.setValue("vrije tekst");
    expect(handle(w).ready).toBe(true);
    expect(handle(w).evaluate()).toMatchObject({ correct: false, score: 0.5, correctAnswer: "Naam: Jan; Plaats: Utrecht" });
    await plaats.setValue("utrecht");
    expect(handle(w).evaluate()).toMatchObject({ correct: true, score: 1 });
  });

  it("a form without any checkable field is 'not scored' (score null), not 0 or 1", async () => {
    const w = await mount(FormFillExercise, ex([field("Naam"), field("Plaats")]));
    await w.findAll("input")[0].setValue("Jan");
    expect(handle(w).evaluate()).toMatchObject({ correct: true, score: null });
  });

  it("after checking, a wrong field shows the expected value", async () => {
    const w = await mount(FormFillExercise, ex([field("Naam", "Jan")]), { checked: true });
    expect(w.text()).toContain("Goed antwoord: Jan");
  });
});

describe("ReadingExercise", () => {
  const q = (id: string, answer: number) => ({ ...base, id, type: "mc", options: ["goed", "fout"], answer });
  const ex = {
    ...base, id: "r", type: "reading",
    document: { kind: "document", docType: "brief", title: "Brief", body: "Lieve Jan," },
    questions: [q("r-1", 0), q("r-2", 1), { ...base, id: "r-3", type: "true-false", statement: "Waar?", answer: true }],
  };
  const choose = (w: VueWrapper, section: number, label: string) =>
    w.findAll("section")[section].findAll("button").find((b) => b.text().replace(/^\d/, "") === label)!.trigger("click");

  it("is ready only when every question has an answer", async () => {
    const w = await mount(ReadingExercise, ex);
    await choose(w, 0, "goed");
    await choose(w, 1, "fout");
    expect(handle(w).ready).toBe(false);
    await choose(w, 2, "Klopt");
    expect(handle(w).ready).toBe(true);
  });

  it("reports each question separately (the shell saves one attempt per question) and a partial score", async () => {
    const w = await mount(ReadingExercise, ex);
    await choose(w, 0, "goed"); // right
    await choose(w, 1, "goed"); // wrong
    await choose(w, 2, "Klopt"); // right
    const r = handle(w).evaluate();
    expect(r.parts).toEqual([
      { itemId: "r-1", correct: true, answer: 0 },
      { itemId: "r-2", correct: false, answer: 0 },
      { itemId: "r-3", correct: true, answer: true },
    ]);
    expect(r).toMatchObject({ correct: false, correctAnswer: "2 van 3 goed" });
    expect(r.score).toBeCloseTo(2 / 3);
  });

  it("number keys do nothing: with several questions on the page a key press would be ambiguous", async () => {
    const w = await mount(ReadingExercise, ex);
    await pressKey("1");
    await pressKey("2");
    expect(handle(w).ready).toBe(false);
  });

  it("all answers right gives correct with no 'x van y' hint", async () => {
    const w = await mount(ReadingExercise, ex);
    await choose(w, 0, "goed");
    await choose(w, 1, "fout");
    await choose(w, 2, "Klopt");
    expect(handle(w).evaluate()).toMatchObject({ correct: true, score: 1, correctAnswer: undefined });
  });
});
