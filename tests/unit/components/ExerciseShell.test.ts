// @vitest-environment jsdom
// The frame around every exercise: check → save the answer(s) → feedback → continue.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import ExerciseShell from "../../../src/components/exercises/ExerciseShell.vue";
import { useSettingsStore } from "../../../src/stores/settings";
import { buttonWith, clickButton, deferred, fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const base = { tags: ["t"], prompt: "Vraag", explanation: "Uitleg bij de vraag.", difficulty: 1 as const };
const mc = (id = "q-1") => ({ ...base, id, type: "mc", options: ["goed", "fout"], answer: 0 });
const reading = {
  ...base, id: "r-1", type: "reading",
  document: { kind: "document", docType: "brief", title: "Brief", body: "Tekst" },
  questions: [{ ...mc("r-1-a") }, { ...mc("r-1-b") }],
};
const writing = {
  ...base, id: "w-1", type: "writing",
  task: { instructions: "Schrijf.", scenario: "Scenario", requiredPoints: ["a"] },
  minWords: 3, maxWords: 20, modelAnswer: "Voorbeeld", checklist: ["Aanhef"], register: "informal",
};

async function mountShell(exercise: any, { hasKey = false, isLast = false } = {}) {
  const m = await mountApp(ExerciseShell, { props: { exercise, isLast } });
  const settings = useSettingsStore(m.pinia);
  settings.settings = (hasKey ? { apiKey: "sk-ant-test" } : { apiKey: null }) as any;
  await flushPromises();
  return m.wrapper;
}
const pick = (w: VueWrapper, label: string, scope = w) => scope.findAll("button").find((b) => b.text().replace(/^\d/, "") === label)!.trigger("click");
const feedback = (w: VueWrapper) => w.find("[role=status]");

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("POST", "/attempts", {});
});

describe("checking an answer", () => {
  it("'Controleer' stays disabled until the exercise is ready", async () => {
    const w = await mountShell(mc());
    expect(buttonWith(w, "Controleer")!.attributes("disabled")).toBeDefined();
    await clickButton(w, "Controleer");
    expect(fakeApi.to("POST", "/attempts")).toHaveLength(0);
    await pick(w, "goed");
    expect(buttonWith(w, "Controleer")!.attributes("disabled")).toBeUndefined();
  });

  it("saves the answer right away with item, type, result and answer, then shows the explanation", async () => {
    const w = await mountShell(mc("q-9"));
    await pick(w, "goed");
    await clickButton(w, "Controleer");
    expect(fakeApi.to("POST", "/attempts")).toEqual([
      { method: "POST", path: "/attempts", body: { itemId: "q-9", exerciseType: "mc", correct: true, answer: 0, durationMs: expect.any(Number) } },
    ]);
    expect(feedback(w).text()).toContain("Uitleg bij de vraag.");
    expect(feedback(w).text()).not.toContain("Leg uit");
  });

  it("a wrong answer shows the right one", async () => {
    const w = await mountShell(mc());
    await pick(w, "fout");
    await clickButton(w, "Controleer");
    expect(feedback(w).text()).toContain("Bijna. Het goede antwoord is:");
    expect(feedback(w).text()).toContain("goed");
    expect(fakeApi.to("POST", "/attempts")[0].body).toMatchObject({ correct: false, answer: 1 });
  });

  it("a reading exercise saves one attempt per question, each under its own id", async () => {
    const w = await mountShell(reading);
    const sections = w.findAll("section");
    await pick(w, "goed", sections[0] as any);
    await pick(w, "fout", sections[1] as any);
    await clickButton(w, "Controleer");
    const bodies = fakeApi.to("POST", "/attempts").map((c) => c.body);
    expect(bodies).toMatchObject([
      { itemId: "r-1-a", exerciseType: "reading", correct: true },
      { itemId: "r-1-b", exerciseType: "reading", correct: false },
    ]);
  });

  it("Enter before an answer is given does nothing", async () => {
    const w = await mountShell(mc());
    await pressKey("Enter");
    expect(feedback(w).exists()).toBe(false);
    expect(fakeApi.to("POST", "/attempts")).toHaveLength(0);
  });

  it("a second Enter continues instead of saving the answer again", async () => {
    const w = await mountShell(mc());
    await pick(w, "goed");
    await pressKey("Enter");
    await pressKey("Enter");
    expect(fakeApi.to("POST", "/attempts")).toHaveLength(1);
    expect(w.emitted("done")).toHaveLength(1);
  });

  it("when saving fails the learner sees why, and can still continue", async () => {
    fakeApi.fail("POST", "/attempts", "Opslaan mislukt");
    const w = await mountShell(mc());
    await pick(w, "goed");
    await clickButton(w, "Controleer");
    expect(feedback(w).text()).toContain("Opslaan mislukt");
    await clickButton(w, "Volgende");
    expect(w.emitted("done")).toHaveLength(1);
  });
});

describe("continuing", () => {
  it("'Volgende' hands the result to the parent; on the last step the button says 'Afronden'", async () => {
    const w = await mountShell(mc(), { isLast: true });
    await pick(w, "goed");
    await clickButton(w, "Controleer");
    expect(buttonWith(w, "Volgende")).toBeUndefined();
    await clickButton(w, "Afronden");
    expect(w.emitted("done")![0][0]).toMatchObject({ correct: true, score: 1, answer: 0 });
  });

  it("Enter checks, the next Enter continues, Escape leaves", async () => {
    const w = await mountShell(mc());
    await pick(w, "goed");
    await pressKey("Enter");
    expect(feedback(w).exists()).toBe(true);
    expect(w.emitted("done")).toBeUndefined();
    await pressKey("Enter");
    expect(w.emitted("done")).toHaveLength(1);
    await pressKey("Escape");
    expect(w.emitted("exit")).toHaveLength(1);
  });

  it("Enter inside a text area is a new line, not 'check'", async () => {
    const w = await mountShell(writing);
    const area = w.find("textarea");
    await area.setValue("een twee drie");
    area.element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await flushPromises();
    expect(feedback(w).exists()).toBe(false);
  });

  it("stops listening to the keyboard after it is removed (no ghost Enter on the next screen)", async () => {
    const w = await mountShell(mc());
    await pick(w, "goed");
    await pressKey("Enter"); // checked
    w.unmount();
    await pressKey("Enter");
    expect(w.emitted("done")).toBeUndefined();
  });
});

describe('"Leg uit" (Claude explains a mistake)', () => {
  it("without an API key it points to the settings and offers no button", async () => {
    const w = await mountShell(mc());
    await pick(w, "fout");
    await clickButton(w, "Controleer");
    expect(buttonWith(w, "Leg uit")).toBeUndefined();
    expect(w.find("a[href='/instellingen']").exists()).toBe(true);
  });

  it("with a key it asks for an explanation of this item and this answer, and shows the result", async () => {
    fakeApi.on("POST", "/claude/explain", { explanation: "Omdat het zo is.", rule: "Regel 1", extraExamples: ["Voorbeeld A", "Voorbeeld B"] });
    const w = await mountShell(mc("q-5"), { hasKey: true });
    await pick(w, "fout");
    await clickButton(w, "Controleer");
    await clickButton(w, "Leg uit");
    expect(fakeApi.to("POST", "/claude/explain")[0].body).toEqual({ itemId: "q-5", learnerAnswer: 1 });
    const text = feedback(w).text();
    expect(text).toContain("Omdat het zo is.");
    expect(text).toContain("Regel: Regel 1");
    expect(text).toContain("Voorbeeld B");
  });

  it("shows 'Claude denkt na…' while waiting and the error text when it fails", async () => {
    const pending = deferred();
    fakeApi.on("POST", "/claude/explain", () => pending.promise);
    const w = await mountShell(mc(), { hasKey: true });
    await pick(w, "fout");
    await clickButton(w, "Controleer");
    await buttonWith(w, "Leg uit")!.trigger("click");
    expect(feedback(w).text()).toContain("Claude denkt na…");
    expect(buttonWith(w, "Leg uit")!.attributes("disabled")).toBeDefined(); // no second request while waiting
    pending.reject(new Error("Geen verbinding met Claude."));
    await flushPromises();
    expect(feedback(w).text()).toContain("Geen verbinding met Claude.");
  });

  it("a reading exercise gets one button per wrong question, and none for the right ones", async () => {
    const w = await mountShell(reading, { hasKey: true });
    const sections = w.findAll("section");
    await pick(w, "goed", sections[0] as any); // right
    await pick(w, "fout", sections[1] as any); // wrong
    await clickButton(w, "Controleer");
    const labels = w.findAll("button").map((b) => b.text()).filter((t) => t.includes("Leg uit"));
    expect(labels).toEqual(["🤖 Leg uit (vraag 2)"]);
    fakeApi.on("POST", "/claude/explain", { explanation: "x", rule: "", extraExamples: [] });
    await clickButton(w, "Leg uit");
    expect(fakeApi.to("POST", "/claude/explain")[0].body).toMatchObject({ itemId: "r-1-b" });
  });
});

describe("exercises made by Claude", () => {
  it("are labelled, and 'Klopt niet' reports the item and moves on without counting it as answered", async () => {
    fakeApi.on("POST", "/generated/gen-7/flag", {});
    const w = await mountShell(mc("gen-7"));
    expect(w.text()).toContain("Deze oefening is gemaakt door Claude.");
    await clickButton(w, "Klopt niet");
    expect(fakeApi.to("POST", "/generated/gen-7/flag")).toHaveLength(1);
    expect(fakeApi.to("POST", "/attempts")).toHaveLength(0);
    expect(w.emitted("done")![0][0]).toMatchObject({ score: null });
  });

  it("still moves on when reporting fails", async () => {
    fakeApi.fail("POST", "/generated/gen-7/flag", "kapot");
    const w = await mountShell(mc("gen-7"));
    await clickButton(w, "Klopt niet");
    expect(w.emitted("done")).toHaveLength(1);
  });

  it("curriculum exercises have neither the label nor the button", async () => {
    const w = await mountShell(mc("basis-a-q-001"));
    expect(w.text()).not.toContain("gemaakt door Claude");
    expect(buttonWith(w, "Klopt niet")).toBeUndefined();
  });
});

describe("writing exercises", () => {
  it("too short is 'not good' but never gets a 'Leg uit' button: there is no right answer to explain", async () => {
    fakeApi.on("POST", "/writing", { id: "sub-1" });
    fakeApi.fail("POST", "/claude/feedback-writing", "Claude is er niet.");
    const w = await mountShell(writing, { hasKey: true });
    await w.find("textarea").setValue("te kort");
    await clickButton(w, "Controleer");
    expect(buttonWith(w, "Leg uit")).toBeUndefined();
  });

  it("are 'not scored': the learner is told to compare with the example, and can try again with the same text", async () => {
    fakeApi.on("POST", "/writing", { id: "sub-1" });
    const w = await mountShell(writing);
    await w.find("textarea").setValue("ik schrijf een bericht");
    await clickButton(w, "Controleer");
    expect(feedback(w).text()).toContain("Klaar! Vergelijk met het voorbeeld.");
    expect(fakeApi.to("POST", "/writing")[0].body).toEqual({ exerciseId: "w-1", text: "ik schrijf een bericht" });

    await clickButton(w, "Probeer opnieuw");
    expect(feedback(w).exists()).toBe(false);
    expect((w.find("textarea").element as HTMLTextAreaElement).value).toBe("ik schrijf een bericht");
    expect(buttonWith(w, "Controleer")).toBeDefined();
  });
});
