// @vitest-environment jsdom
// The mock exam player: timer, autosave, resume, hand-in. A mistake here costs the learner a real attempt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import ExamView from "../../../src/views/ExamView.vue";
import { buttonWith, clickButton, fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const mc = (id: string, options = ["a", "b", "c"]) => ({ id, type: "mc", tags: ["knm:wonen"], prompt: `Vraag ${id}`, options, answer: 0, explanation: "e", difficulty: 1 });
const writingTask = {
  id: "w1", type: "writing", tags: ["schrijven:kort-bericht"], prompt: "Schrijf een bericht", explanation: "e", difficulty: 1,
  task: { instructions: "Schrijf aan je buur.", scenario: "Feestje", requiredPoints: ["wat", "wanneer"] },
  minWords: 3, maxWords: 20, modelAnswer: "x", checklist: [], register: "informal",
};
const exam = (items: unknown[], extra: Record<string, unknown> = {}) => ({ id: "ex1", skill: "knm", title: "Proefexamen 1", durationMinutes: 30, passScore: 0.6, items, ...extra });

const MIN = 60_000;
const T0 = new Date("2026-03-01T10:00:00Z").getTime();
let state: { id: string; startedAt: string; answers: Record<string, unknown>; flagged: string[]; position: number };

function setup(opts: { items?: unknown[]; examExtra?: Record<string, unknown>; minutesLeft?: number; saved?: Partial<typeof state> } = {}) {
  const items = opts.items ?? [mc("q1"), mc("q2"), mc("q3")];
  const left = (opts.minutesLeft ?? 30) * MIN;
  state = { id: "res1", startedAt: new Date(T0 + left - 30 * MIN).toISOString(), answers: {}, flagged: [], position: 0, ...opts.saved };
  fakeApi.on("GET", "/exams/ex1", exam(items, opts.examExtra));
  fakeApi.on("POST", "/exams/ex1/start", () => ({ result: state, remainingMs: left }));
}
const open = () => mountApp(ExamView, { routePath: "/examen/:id", url: "/examen/ex1" });
const choose = (w: VueWrapper, label: string) => w.findAll("button").find((b) => b.text().replace(/^\d/, "") === label)!.trigger("click");
const nav = (w: VueWrapper, n: number) => w.find(`nav button[aria-label^='Vraag ${n}:'], nav button[aria-label^='Opdracht ${n}:']`);
const timer = (w: VueWrapper) => w.find("[role=timer]").text();
const saves = () => fakeApi.to("PUT", "/exams/results/res1/state").map((c) => c.body);
const submits = () => fakeApi.to("POST", "/exams/results/res1/submit");
const tick = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  await flushPromises();
};

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET", "/settings", { apiKey: null, spellcheckWriting: false });
  fakeApi.on("PUT", "/exams/results/res1/state", {});
  fakeApi.on("POST", "/exams/results/res1/submit", {});
  vi.useFakeTimers({ now: T0, toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
});
afterEach(() => vi.useRealTimers());

describe("starting", () => {
  it("shows the first question and the time left, counting down", async () => {
    setup();
    const { wrapper } = await open();
    expect(wrapper.text()).toContain("Vraag 1 van 3");
    expect(wrapper.text()).toContain("Vraag q1");
    expect(timer(wrapper)).toContain("30:00");
    await tick(5000);
    expect(timer(wrapper)).toContain("29:55");
  });

  it("resumes with the saved answers, marks and position", async () => {
    setup({ minutesLeft: 12, saved: { answers: { q1: [1] }, flagged: ["q3"], position: 1 } });
    const { wrapper } = await open();
    expect(wrapper.text()).toContain("Vraag 2 van 3");
    expect(timer(wrapper)).toContain("12:00");
    expect(nav(wrapper, 1).attributes("aria-label")).toBe("Vraag 1: beantwoord");
    expect(nav(wrapper, 2).attributes("aria-label")).toBe("Vraag 2: open");
    expect(nav(wrapper, 3).attributes("aria-label")).toBe("Vraag 3: open, gemarkeerd");
  });

  it("a saved position beyond the last question lands on the last question", async () => {
    setup({ saved: { position: 99 } });
    const { wrapper } = await open();
    expect(wrapper.text()).toContain("Vraag 3 van 3");
  });

  it("an exam that cannot be loaded shows why", async () => {
    fakeApi.fail("GET", "/exams/ex1", "Examen niet gevonden.");
    const { wrapper } = await open();
    expect(wrapper.text()).toContain("Examen niet gevonden.");
  });
});

describe("answering and saving", () => {
  it("choosing an answer marks the question answered in the overview", async () => {
    setup();
    const { wrapper } = await open();
    await choose(wrapper, "b");
    expect(nav(wrapper, 1).attributes("aria-label")).toBe("Vraag 1: beantwoord");
  });

  it("saves answers, marks and position shortly after a change, in a single request for a burst of changes", async () => {
    setup();
    const { wrapper } = await open();
    await choose(wrapper, "a");
    await clickButton(wrapper, "Volgende");
    await choose(wrapper, "c");
    await clickButton(wrapper, "Markeer");
    expect(saves()).toHaveLength(0); // not on every click
    await tick(400);
    expect(saves()).toEqual([{ answers: { q1: [0], q2: [2] }, flagged: ["q2"], position: 1 }]);
  });

  it("changing an answer keeps only the last choice", async () => {
    setup();
    const { wrapper } = await open();
    await choose(wrapper, "a");
    await choose(wrapper, "b");
    await tick(400);
    expect((saves().at(-1) as any).answers).toEqual({ q1: [1] });
  });

  it("marking can be undone", async () => {
    setup();
    const { wrapper } = await open();
    await clickButton(wrapper, "Markeer");
    expect(nav(wrapper, 1).attributes("aria-label")).toContain("gemarkeerd");
    await clickButton(wrapper, "Markering weg");
    expect(nav(wrapper, 1).attributes("aria-label")).not.toContain("gemarkeerd");
  });

  it("if saving fails the learner is told their answers are still on screen", async () => {
    setup();
    fakeApi.fail("PUT", "/exams/results/res1/state", "kapot");
    const { wrapper } = await open();
    await choose(wrapper, "a");
    await tick(400);
    expect(wrapper.text()).toContain("Opslaan lukt niet. Je antwoorden staan nog op dit scherm.");
    fakeApi.on("PUT", "/exams/results/res1/state", {});
    await choose(wrapper, "b");
    await tick(400);
    expect(wrapper.text()).not.toContain("Opslaan lukt niet");
  });
});

describe("moving around", () => {
  it("the overview jumps to a question; Vorige/Volgende stop at the ends", async () => {
    setup();
    const { wrapper } = await open();
    expect(buttonWith(wrapper, "Vorige")!.attributes("disabled")).toBeDefined();
    await nav(wrapper, 3).trigger("click");
    expect(wrapper.text()).toContain("Vraag 3 van 3");
    expect(buttonWith(wrapper, "Volgende")!.attributes("disabled")).toBeDefined();
  });

  it("arrow keys move between questions, but not while typing or while the hand-in dialog is open", async () => {
    setup({ items: [writingTask, mc("q2")], examExtra: { skill: "schrijven" } });
    const { wrapper } = await open();
    const area = wrapper.find("textarea");
    area.element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flushPromises();
    expect(wrapper.text()).toContain("Opdracht 1 van 2"); // typing: stays
    (document.activeElement as HTMLElement | null)?.blur?.();
    await pressKey("ArrowRight");
    expect(wrapper.text()).toContain("Opdracht 2 van 2");
    await pressKey("ArrowLeft");
    expect(wrapper.text()).toContain("Opdracht 1 van 2");
    await clickButton(wrapper, "Inleveren");
    await pressKey("ArrowRight");
    expect(wrapper.text()).toContain("Opdracht 1 van 2");
  });
});

describe("handing in", () => {
  it("the dialog says how many questions are still open", async () => {
    setup();
    const { wrapper } = await open();
    await choose(wrapper, "a");
    await clickButton(wrapper, "Inleveren");
    expect(wrapper.text()).toContain("2 onderdelen zijn nog niet (helemaal) beantwoord.");
  });

  it("when everything is answered it says so", async () => {
    setup({ items: [mc("q1")] });
    const { wrapper } = await open();
    await choose(wrapper, "a");
    await clickButton(wrapper, "Inleveren");
    expect(wrapper.text()).toContain("Je hebt alles beantwoord.");
  });

  it("'Terug naar het examen' closes the dialog without handing in", async () => {
    setup();
    const { wrapper } = await open();
    await clickButton(wrapper, "Inleveren");
    await clickButton(wrapper, "Terug naar het examen");
    expect(wrapper.find("[role=dialog]").exists()).toBe(false);
    expect(submits()).toHaveLength(0);
  });

  it("sends the final answers and goes to the result page; a double click hands in once", async () => {
    setup();
    const { wrapper, router } = await open();
    await choose(wrapper, "c");
    await clickButton(wrapper, "Inleveren");
    const confirm = buttonWith(wrapper, "Ja, inleveren")!;
    await confirm.trigger("click");
    await confirm.trigger("click");
    await flushPromises();
    expect(submits().map((c) => c.body)).toEqual([{ answers: { q1: [2] }, flagged: [], position: 0 }]);
    expect(router.currentRoute.value.path).toBe("/examen/ex1/resultaat/res1");
  });

  it("an autosave that was still waiting is dropped once the exam is handed in", async () => {
    setup();
    const { wrapper } = await open();
    await choose(wrapper, "a");
    await clickButton(wrapper, "Inleveren");
    await clickButton(wrapper, "Ja, inleveren");
    await tick(2000);
    expect(saves()).toHaveLength(0);
  });
});

describe("the clock", () => {
  it("time already up when the learner comes back: the exam is handed in at once with the saved answers", async () => {
    setup({ minutesLeft: 0, saved: { answers: { q1: [1] }, position: 2 } });
    fakeApi.on("POST", "/exams/ex1/start", () => ({ result: state, remainingMs: 0 }));
    const { router } = await open();
    expect(submits().map((c) => c.body)).toEqual([{ answers: { q1: [1] }, flagged: [], position: 2 }]);
    expect(router.currentRoute.value.path).toBe("/examen/ex1/resultaat/res1");
  });

  it("warns once at 10 and once at 5 minutes, and the warning goes away by itself", async () => {
    setup({ minutesLeft: 10.05 });
    const { wrapper } = await open();
    expect(wrapper.text()).not.toContain("Nog 10 minuten.");
    await tick(5000);
    expect(wrapper.find("[role=alert]").text()).toBe("Nog 10 minuten.");
    await tick(9000);
    expect(wrapper.find("[role=alert]").exists()).toBe(false);
    await tick(292_000); // 5:06 elapsed of the 10:03 we started with → the 5 minute mark has just passed
    expect(wrapper.find("[role=alert]").text()).toBe("Nog 5 minuten.");
  });

  it("coming back with only 3 minutes left does not announce 10 or 5 minutes", async () => {
    setup({ minutesLeft: 3 });
    const { wrapper } = await open();
    await tick(3000);
    expect(wrapper.find("[role=alert]").exists()).toBe(false);
  });

  it("when the time runs out the exam is handed in automatically, once", async () => {
    setup({ minutesLeft: 0.05 }); // 3 seconds
    const { wrapper, router } = await open();
    await choose(wrapper, "b");
    await tick(2000);
    expect(submits()).toHaveLength(0);
    await tick(2000);
    expect(submits()).toHaveLength(1);
    expect(submits()[0].body).toMatchObject({ answers: { q1: [1] } });
    await tick(5000);
    expect(submits()).toHaveLength(1);
    expect(router.currentRoute.value.path).toBe("/examen/ex1/resultaat/res1");
  });

  it("leaving the exam stops the clock: nothing is handed in behind the learner's back", async () => {
    setup({ minutesLeft: 0.05 });
    const { wrapper } = await open();
    wrapper.unmount();
    await tick(10_000);
    expect(submits()).toHaveLength(0);
  });
});

describe("writing and form exams", () => {
  it("shows the task, counts words while typing, and saves the text", async () => {
    setup({ items: [writingTask], examExtra: { skill: "schrijven" } });
    const { wrapper } = await open();
    expect(wrapper.text()).toContain("Schrijf aan je buur.");
    expect(wrapper.text()).toContain("0 woorden (tussen 3 en 20)");
    await wrapper.find("textarea").setValue("ik kom graag langs");
    expect(wrapper.text()).toContain("4 woorden");
    expect(nav(wrapper, 1).attributes("aria-label")).toBe("Opdracht 1: beantwoord");
    await tick(400);
    expect((saves().at(-1) as any).answers).toEqual({ w1: "ik kom graag langs" });
  });

  it("a writing task with only spaces counts as not answered", async () => {
    setup({ items: [writingTask], examExtra: { skill: "schrijven" } });
    const { wrapper } = await open();
    await wrapper.find("textarea").setValue("   ");
    expect(nav(wrapper, 1).attributes("aria-label")).toBe("Opdracht 1: open");
  });

  it("a reading item is 'half answered' until every question has an answer", async () => {
    const reading = {
      id: "r1", type: "reading", tags: ["lezen:brief"], prompt: "Lees", explanation: "e", difficulty: 1,
      document: { kind: "document", docType: "brief", title: "Brief", body: "Tekst" },
      questions: [mc("r1-a"), mc("r1-b")],
    };
    setup({ items: [reading], examExtra: { skill: "lezen" } });
    const { wrapper } = await open();
    await wrapper.findAll("button").find((b) => b.text().replace(/^\d/, "") === "a")!.trigger("click");
    expect(nav(wrapper, 1).attributes("aria-label")).toBe("Vraag 1: half beantwoord");
  });
});
