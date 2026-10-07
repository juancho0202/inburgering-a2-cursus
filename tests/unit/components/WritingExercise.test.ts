// @vitest-environment jsdom
// A writing task: the text is always saved first; feedback from Claude only comes on top of that.
import { beforeEach, describe, expect, it, vi } from "vitest";
import WritingExercise from "../../../src/components/exercises/WritingExercise.vue";
import { useSettingsStore } from "../../../src/stores/settings";
import { ApiRequestError, buttonWith, clickButton, deferred, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const exercise = {
  id: "w-1", type: "writing", tags: ["schrijven:kort-bericht"], prompt: "Schrijf een bericht", explanation: "e", difficulty: 1,
  task: { instructions: "Schrijf aan je buur.", scenario: "Je geeft een feestje.", requiredPoints: ["Wat", "Wanneer"] },
  minWords: 5, maxWords: 10, modelAnswer: "Hoi buurman, ...", checklist: ["Aanhef", "Afsluiting"], register: "informal",
};
const feedback = {
  overall: "bijna", score: 6.5,
  criteria: [{ name: "Opdracht", score: 2, comment: "Bijna alles." }],
  missingPoints: ["Wanneer"],
  corrections: [{ original: "ik heb gaan", corrected: "ik ben gegaan", type: "werkwoord", explanation: "Voltooid deelwoord." }],
  correctedText: "Ik ben gegaan naar het feest.", strongPoints: ["Duidelijk"], nextTip: "Let op het deelwoord.",
};

async function mountWriting({ hasKey = false, checked = false, prefill }: { hasKey?: boolean; checked?: boolean; prefill?: string } = {}) {
  const m = await mountApp(WritingExercise, { props: { exercise, checked, prefill } });
  useSettingsStore(m.pinia).settings = { apiKey: hasKey ? "sk-x" : null, spellcheckWriting: false } as any;
  await flushPromises();
  return m.wrapper;
}
type Handle = { ready: boolean; evaluate: () => any };

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("POST", "/writing", { id: "sub-1" });
});

describe("typing", () => {
  it("counts words and turns the counter red outside the allowed range", async () => {
    const w = await mountWriting();
    const counter = () => w.find("p[aria-live=polite]");
    expect(counter().text()).toBe("0 woorden (tussen 5 en 10)");
    await w.find("textarea").setValue("een twee drie");
    expect(counter().classes()).toContain("text-bad");
    await w.find("textarea").setValue("een twee drie vier vijf");
    expect(counter().classes()).toContain("text-good");
    await w.find("textarea").setValue("een twee drie vier vijf zes zeven acht negen tien elf");
    expect(counter().classes()).toContain("text-bad");
    expect(counter().text()).toContain("11 woorden");
  });

  it("is ready as soon as there is any text (the word range is a hint, not a gate)", async () => {
    const w = await mountWriting();
    expect((w.vm as unknown as Handle).ready).toBe(false);
    await w.find("textarea").setValue("   ");
    expect((w.vm as unknown as Handle).ready).toBe(false);
    await w.find("textarea").setValue("hoi");
    expect((w.vm as unknown as Handle).ready).toBe(true);
  });

  it("continues with the text of a previous try", async () => {
    const w = await mountWriting({ prefill: "eerdere tekst" });
    expect((w.find("textarea").element as HTMLTextAreaElement).value).toBe("eerdere tekst");
  });
});

describe("handing in", () => {
  it("saves the text, and 'correct' only means long enough: writing is never scored", async () => {
    const w = await mountWriting();
    await w.find("textarea").setValue("een twee drie vier");
    const short = (w.vm as unknown as Handle).evaluate();
    expect(short).toMatchObject({ correct: false, score: null, answer: "een twee drie vier" });
    await w.find("textarea").setValue("een twee drie vier vijf");
    expect((w.vm as unknown as Handle).evaluate()).toMatchObject({ correct: true, score: null });
    expect(fakeApi.to("POST", "/writing").map((c) => c.body)).toEqual([
      { exerciseId: "w-1", text: "een twee drie vier" },
      { exerciseId: "w-1", text: "een twee drie vier vijf" },
    ]);
  });

  it("a failing save does not break checking", async () => {
    fakeApi.fail("POST", "/writing", "Opslaan mislukt");
    const w = await mountWriting();
    await w.find("textarea").setValue("een twee drie vier vijf");
    expect(() => (w.vm as unknown as Handle).evaluate()).not.toThrow();
    await flushPromises();
  });

  it("is locked after checking", async () => {
    const w = await mountWriting({ checked: true });
    expect(w.find("textarea").attributes("disabled")).toBeDefined();
  });
});

describe("after checking, without an API key", () => {
  it("points to the settings and still shows the example and the checklist", async () => {
    const w = await mountWriting({ checked: true });
    expect(w.text()).toContain("Geen feedback van Claude");
    expect(w.find("a[href='/instellingen']").exists()).toBe(true);
    expect(w.text()).toContain("Hoi buurman");
    expect(w.text()).toContain("Aanhef");
    expect(fakeApi.to("POST", "/claude/feedback-writing")).toHaveLength(0);
  });
});

describe("after checking, with an API key", () => {
  async function check(w: Awaited<ReturnType<typeof mountWriting>>, text: string) {
    await w.find("textarea").setValue(text);
    (w.vm as unknown as Handle).evaluate();
    await w.setProps({ checked: true });
    await flushPromises();
  }

  it("asks Claude about the text that was just saved, and shows corrections in the text", async () => {
    fakeApi.on("POST", "/claude/feedback-writing", { feedback });
    const w = await mountWriting({ hasKey: true });
    await check(w, "ik heb gaan naar het feest");
    expect(fakeApi.to("POST", "/claude/feedback-writing")[0].body).toEqual({ exerciseId: "w-1", text: "ik heb gaan naar het feest", submissionId: "sub-1" });
    expect(w.text()).toContain("Bijna voldoende");
    expect(w.text()).toContain("Score: 6.5 van 10");
    expect(w.find("del").text()).toBe("ik heb gaan");
    expect(w.find("ins").text()).toBe("ik ben gegaan");
    expect(w.text()).toContain("Dit punt ontbreekt");
  });

  it("waits for the save before asking, so the feedback is linked to the saved text", async () => {
    const saving = deferred();
    fakeApi.on("POST", "/writing", () => saving.promise);
    fakeApi.on("POST", "/claude/feedback-writing", { feedback });
    const w = await mountWriting({ hasKey: true });
    await check(w, "ik heb gaan naar het feest");
    expect(fakeApi.to("POST", "/claude/feedback-writing")).toHaveLength(0);
    saving.resolve({ id: "sub-9" });
    await flushPromises();
    expect(fakeApi.to("POST", "/claude/feedback-writing")[0].body).toMatchObject({ submissionId: "sub-9" });
  });

  it("shows a waiting message while Claude reads", async () => {
    const pending = deferred();
    fakeApi.on("POST", "/claude/feedback-writing", () => pending.promise);
    const w = await mountWriting({ hasKey: true });
    await check(w, "ik heb gaan naar het feest");
    expect(w.text()).toContain("Claude leest je tekst…");
    pending.resolve({ feedback });
    await flushPromises();
    expect(w.text()).not.toContain("Claude leest je tekst…");
  });

  it("when Claude fails the text stays saved, the error is shown, and 'Probeer feedback opnieuw' reuses the saved text", async () => {
    let calls = 0;
    fakeApi.on("POST", "/claude/feedback-writing", () => {
      if (calls++ === 0) throw new ApiRequestError("Claude is overbelast.", "overloaded", { submissionId: "sub-1" });
      return { feedback };
    });
    const w = await mountWriting({ hasKey: true });
    await check(w, "ik heb gaan naar het feest");
    expect(w.text()).toContain("Claude is overbelast.");
    expect(w.text()).toContain("Je tekst is opgeslagen.");
    expect(w.text()).toContain("Hoi buurman"); // the self-check is still there
    await clickButton(w, "Probeer feedback opnieuw");
    expect(fakeApi.to("POST", "/claude/feedback-writing")).toHaveLength(2);
    expect(w.text()).toContain("Bijna voldoende");
  });

  it("asks only once per check, even when other props change afterwards", async () => {
    fakeApi.on("POST", "/claude/feedback-writing", { feedback });
    const w = await mountWriting({ hasKey: true });
    await check(w, "ik heb gaan naar het feest");
    await w.setProps({ prefill: "x" });
    expect(fakeApi.to("POST", "/claude/feedback-writing")).toHaveLength(1);
  });
});
