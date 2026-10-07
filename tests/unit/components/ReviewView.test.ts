// @vitest-environment jsdom
// Word and verb review (spaced repetition): answer a card, see the result, grade it, next card.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import ReviewView from "../../../src/views/ReviewView.vue";
import { buttonWith, clickButton, deferred, fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const vocab = (nl: string, over: Record<string, unknown> = {}) => ({
  id: `v-${nl}`, nl, article: "de", definitionNl: `Betekenis van ${nl}`, example: `Dit is een ${nl} in een zin.`, ...over,
});
const verb = (over: Record<string, unknown> = {}) => ({
  id: "werken", infinitive: "werken", participle: "gewerkt", auxiliary: "hebben", definitionNl: "doen voor geld", example: "Ik heb gewerkt.", ...over,
});
const card = (id: string, cardType: string) => ({ id, cardType });
const item = (cardId: string, cardType: string, extra: Record<string, unknown>) => ({ card: card(cardId, cardType), vocab: null, verb: null, distractors: [], ...extra });

const meaning = (nl: string) => item(`c-${nl}`, "meaning", { vocab: vocab(nl) });
const open = (queue: unknown[], url = "/woorden/herhalen") => {
  fakeApi.on("GET", /^\/srs\/due/, queue);
  return mountApp(ReviewView, { routePath: "/woorden/herhalen", url });
};
const reviews = () => fakeApi.to("POST", "/srs/review").map((c) => c.body);
const type = (w: VueWrapper, value: string) => w.find("input").setValue(value);

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("POST", "/srs/review", {});
});

describe("loading", () => {
  it("asks for up to 30 due cards (only verbs when coming from the verb page)", async () => {
    await open([]);
    await open([], "/woorden/herhalen?kind=verb");
    expect(fakeApi.to("GET", /^\/srs\/due/).map((c) => c.path)).toEqual(["/srs/due?kind=all&limit=30", "/srs/due?kind=verb&limit=30"]);
  });

  it("nothing due: says so, without a card", async () => {
    const { wrapper } = await open([]);
    expect(wrapper.text()).toContain("Je hebt vandaag alle woorden herhaald");
  });

  it("a load error is shown", async () => {
    fakeApi.fail("GET", /^\/srs\/due/, "Database niet beschikbaar.");
    const { wrapper } = await mountApp(ReviewView, { routePath: "/woorden/herhalen", url: "/woorden/herhalen" });
    expect(wrapper.text()).toContain("Database niet beschikbaar.");
  });
});

describe("'meaning' cards (type the word)", () => {
  it("shows the definition and a sentence with the word blanked out", async () => {
    const { wrapper } = await open([item("c1", "meaning", { vocab: vocab("fiets", { example: "Ik ga met de Fiets naar school." }) })]);
    expect(wrapper.text()).toContain("Betekenis van fiets");
    expect(wrapper.text()).toContain("Ik ga met de ___ naar school.");
  });

  it("'Controleer' is disabled until something is typed", async () => {
    const { wrapper } = await open([meaning("fiets")]);
    expect(buttonWith(wrapper, "Controleer")!.attributes("disabled")).toBeDefined();
    await type(wrapper, "fie");
    expect(buttonWith(wrapper, "Controleer")!.attributes("disabled")).toBeUndefined();
  });

  it("accepts the word with or without its article, any case", async () => {
    for (const answer of ["de fiets", "Fiets", "  FIETS "]) {
      const { wrapper } = await open([item("c1", "meaning", { vocab: vocab("de fiets") })]);
      await type(wrapper, answer);
      await clickButton(wrapper, "Controleer");
      expect(wrapper.text()).toContain("✓ Goed zo!");
    }
  });

  it("a wrong word shows the right one with its example", async () => {
    const { wrapper } = await open([meaning("fiets")]);
    await type(wrapper, "auto");
    await clickButton(wrapper, "Controleer");
    expect(wrapper.text()).toContain("✗ Niet goed.");
    expect(wrapper.text()).toContain("Dit is een fiets in een zin.");
  });

  it("grading sends the card and grade, and moves to the next card", async () => {
    const { wrapper } = await open([meaning("fiets"), meaning("boom")]);
    await type(wrapper, "fiets");
    await clickButton(wrapper, "Controleer");
    await clickButton(wrapper, "Makkelijk");
    expect(reviews()).toEqual([{ cardId: "c-fiets", grade: "makkelijk" }]);
    expect(wrapper.text()).toContain("Betekenis van boom");
    expect(wrapper.text()).toContain("1 / 2");
  });

  it("the typed text is cleared for the next card", async () => {
    const { wrapper } = await open([meaning("fiets"), meaning("boom")]);
    await type(wrapper, "fiets");
    await clickButton(wrapper, "Controleer");
    await clickButton(wrapper, "Goed");
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe("");
  });
});

describe("keyboard", () => {
  it("Enter checks; the next Enter grades 'goed' after a right answer and 'opnieuw' after a wrong one", async () => {
    const { wrapper } = await open([meaning("fiets"), meaning("boom"), meaning("huis")]);
    await type(wrapper, "fiets");
    await pressKey("Enter");
    expect(wrapper.text()).toContain("✓ Goed zo!");
    await pressKey("Enter");
    await type(wrapper, "verkeerd");
    await pressKey("Enter");
    await pressKey("Enter");
    expect(reviews()).toEqual([
      { cardId: "c-fiets", grade: "goed" },
      { cardId: "c-boom", grade: "opnieuw" },
    ]);
  });

  it("keys 1–4 pick Opnieuw / Moeilijk / Goed / Makkelijk once the answer is shown, not before", async () => {
    const { wrapper } = await open([meaning("fiets"), meaning("boom")]);
    await pressKey("3");
    expect(reviews()).toEqual([]);
    await type(wrapper, "fiets");
    await pressKey("Enter");
    await pressKey("2");
    expect(reviews()).toEqual([{ cardId: "c-fiets", grade: "moeilijk" }]);
  });

  it("typing a digit into the answer box does not grade anything", async () => {
    const { wrapper } = await open([meaning("fiets")]);
    await type(wrapper, "fiets");
    await pressKey("Enter");
    wrapper.find("input").element.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
    await flushPromises();
    expect(reviews()).toEqual([]);
  });

  it("a second Enter while the grade is still being saved does not grade the next card unseen", async () => {
    // key repeat or a double tap: the first Enter grades card 1, the second must not answer card 2 blind
    const saving = deferred();
    fakeApi.on("POST", "/srs/review", () => saving.promise);
    const { wrapper } = await open([meaning("fiets"), meaning("boom")]);
    await type(wrapper, "fiets");
    await pressKey("Enter"); // check
    await pressKey("Enter"); // grade card 1 (save is slow)
    await pressKey("Enter"); // impatient second press
    saving.resolve({});
    await flushPromises();
    expect(reviews()).toEqual([{ cardId: "c-fiets", grade: "goed" }]);
    expect(wrapper.text()).toContain("Betekenis van boom");
    expect(wrapper.text()).not.toContain("✓ Goed zo!");
  });
});

describe("'Opnieuw' and progress", () => {
  it("a card graded 'Opnieuw' comes back at the end of the session and does not count as reviewed", async () => {
    const { wrapper } = await open([meaning("fiets"), meaning("boom")]);
    await type(wrapper, "x");
    await clickButton(wrapper, "Controleer");
    await clickButton(wrapper, "Opnieuw");
    expect(wrapper.text()).toContain("0 / 2");
    await type(wrapper, "boom");
    await clickButton(wrapper, "Controleer");
    await clickButton(wrapper, "Goed");
    expect(wrapper.text()).toContain("Betekenis van fiets"); // back again
    await type(wrapper, "fiets");
    await clickButton(wrapper, "Controleer");
    await clickButton(wrapper, "Goed");
    expect(wrapper.text()).toContain("2 kaartjes herhaald.");
    expect(reviews().map((r: any) => r.grade)).toEqual(["opnieuw", "goed", "goed"]);
  });

  it("a failed save is shown but the session continues", async () => {
    fakeApi.fail("POST", "/srs/review", "Opslaan mislukt.");
    const { wrapper } = await open([meaning("fiets"), meaning("boom")]);
    await type(wrapper, "fiets");
    await clickButton(wrapper, "Controleer");
    await clickButton(wrapper, "Goed");
    expect(wrapper.text()).toContain("Opslaan mislukt.");
    expect(wrapper.text()).toContain("Betekenis van boom");
  });
});

describe("'recognise' cards (pick the meaning)", () => {
  const recognise = (distractors: string[]) => item("c-r", "recognise", { vocab: vocab("fiets"), distractors });

  it("offers the right meaning among the distractors, and judges the choice", async () => {
    const { wrapper } = await open([recognise(["Betekenis X", "Betekenis Y"])]);
    expect(wrapper.text()).toContain("Wat betekent dit woord?");
    await wrapper.findAll("button").find((b) => b.text() === "Betekenis X")!.trigger("click");
    await clickButton(wrapper, "Controleer");
    expect(wrapper.text()).toContain("✗ Niet goed.");
  });

  it("choosing the right meaning is right", async () => {
    const { wrapper } = await open([recognise(["Betekenis X"])]);
    await wrapper.findAll("button").find((b) => b.text() === "Betekenis van fiets")!.trigger("click");
    await clickButton(wrapper, "Controleer");
    expect(wrapper.text()).toContain("✓ Goed zo!");
  });

  it("with no distractors it falls back to 'Toon antwoord' and the learner says whether they knew it", async () => {
    const { wrapper } = await open([recognise([])]);
    await clickButton(wrapper, "Toon antwoord");
    expect(wrapper.text()).toContain("✓ Goed zo!"); // self-check: showing the answer is not a mistake by itself
    expect(wrapper.text()).toContain("Betekenis van fiets");
  });
});

describe("'article' cards (de or het)", () => {
  it("picking the article judges immediately", async () => {
    const { wrapper } = await open([item("c-a", "article", { vocab: vocab("huis", { nl: "het huis", article: "het" }) })]);
    expect(wrapper.text()).toContain("de of het?");
    expect(wrapper.text()).toContain("huis");
    await wrapper.findAll("button").find((b) => b.text() === "de")!.trigger("click");
    expect(wrapper.text()).toContain("✗ Niet goed.");
  });

  it("the right article is right", async () => {
    const { wrapper } = await open([item("c-a", "article", { vocab: vocab("het huis", { article: "het" }) })]);
    await wrapper.findAll("button").find((b) => b.text() === "het")!.trigger("click");
    expect(wrapper.text()).toContain("✓ Goed zo!");
  });
});

describe("'verb-forms' cards (participle + hebben/zijn)", () => {
  const open1 = (v: Record<string, unknown>) => open([item("c-v", "verb-forms", { verb: verb(v) })]);
  const answer = async (w: VueWrapper, participle: string, aux: string) => {
    await w.find("input").setValue(participle);
    await w.find("select").setValue(aux);
    await clickButton(w, "Controleer");
  };

  it("needs both the participle and hebben/zijn before it can be checked", async () => {
    const { wrapper } = await open1({});
    await type(wrapper, "gewerkt");
    expect(buttonWith(wrapper, "Controleer")!.attributes("disabled")).toBeDefined();
  });

  it("is right only with the right participle and the right auxiliary", async () => {
    const ok = await open1({});
    await answer(ok.wrapper, "gewerkt", "hebben");
    expect(ok.wrapper.text()).toContain("✓ Goed zo!");
    expect(ok.wrapper.text()).toContain("heeft gewerkt");

    const wrongAux = await open1({});
    await answer(wrongAux.wrapper, "gewerkt", "zijn");
    expect(wrongAux.wrapper.text()).toContain("✗ Niet goed.");

    const wrongForm = await open1({});
    await answer(wrongForm.wrapper, "gewerkd", "hebben");
    expect(wrongForm.wrapper.text()).toContain("✗ Niet goed.");
  });

  it("a verb that takes either auxiliary accepts both", async () => {
    for (const aux of ["hebben", "zijn"]) {
      const { wrapper } = await open1({ infinitive: "vliegen", participle: "gevlogen", auxiliary: "both" });
      await answer(wrapper, "gevlogen", aux);
      expect(wrapper.text()).toContain("✓ Goed zo!");
    }
  });

  it("the answer line uses 'is' for zijn-verbs", async () => {
    const { wrapper } = await open1({ infinitive: "gaan", participle: "gegaan", auxiliary: "zijn" });
    await answer(wrapper, "x", "hebben");
    expect(wrapper.text()).toContain("is gegaan");
  });
});
