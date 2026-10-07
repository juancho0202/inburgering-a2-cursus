// @vitest-environment jsdom
// The lesson player: resume, step-by-step progress, finishing, and moving on to another lesson.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import UnitView from "../../../src/views/UnitView.vue";
import { buttonWith, clickButton, deferred, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const mc = (id: string) => ({ id, type: "mc", tags: ["t"], prompt: "Vraag", options: ["a", "b"], answer: 0, explanation: "e", difficulty: 1 });
const exercise = (id: string) => ({ type: "exercise", exercise: mc(id) });
const lesson = (id: string) => ({ type: "lesson", id: `${id}-l`, title: `Uitleg ${id}`, blocks: [] });
const unit = (id: string, steps: unknown[], passScore = 0.7) => ({
  id, moduleId: "m", title: `Les ${id.toUpperCase()}`, goal: `Doel ${id}`, estimatedMinutes: 5, tags: [], vocabRefs: [], passScore, steps,
});
const units: Record<string, ReturnType<typeof unit>> = {
  a: unit("a", [lesson("a")]),
  b: unit("b", [lesson("b1"), lesson("b2"), lesson("b3")]),
  c: unit("c", [lesson("c"), exercise("c-q1"), exercise("c-q2")]),
  d: unit("d", [exercise("d-q1"), exercise("d-q2")], 0.5),
};
const course = { modules: [{ id: "m", units: [{ id: "a", title: "Les A" }, { id: "b", title: "Les B" }, { id: "c", title: "Les C" }] }] };

// ExerciseShell has its own tests; here it is a button that reports "done".
const ShellStub = { props: ["exercise", "isLast"], emits: ["done"], template: `<button @click="$emit('done', { correct: true, score: 1, answer: 0 })">stub-{{ exercise.id }}</button>` };

let progress: { units: Record<string, unknown>; items: Record<string, unknown> };
beforeEach(() => {
  fakeApi.reset();
  progress = { units: {}, items: {} };
  fakeApi.on("GET", "/progress", () => progress);
  fakeApi.on("GET", "/course", course);
  fakeApi.on("GET", /^\/units\/[a-z]+$/, (_b, p) => units[p.split("/")[2]]);
  fakeApi.on("POST", /^\/units\/[a-z]+\/step$/, {});
  fakeApi.on("POST", /^\/units\/[a-z]+\/complete$/, { wordsIntroduced: 0 });
  fakeApi.on("GET", /^\/practice\?/, []);
});

const open = (id: string) => mountApp(UnitView, { routePath: "/unit/:id", url: `/unit/${id}`, stubs: { ExerciseShell: ShellStub, LessonBlocks: true, ReportIssue: true } });
const stepCounter = (w: VueWrapper) => w.text().match(/(\d+) \/ (\d+)/)?.slice(1, 3).map(Number);
const stepPosts = () => fakeApi.to("POST", /\/step$/).map((c) => c.body);

describe("starting and resuming", () => {
  it("starts at the first step, showing the lesson goal", async () => {
    const { wrapper } = await open("b");
    expect(stepCounter(wrapper)).toEqual([1, 3]);
    expect(wrapper.text()).toContain("Doel b");
  });

  it("resumes an unfinished lesson where the learner stopped, and says so", async () => {
    progress.units.b = { status: "in_progress", stepIndex: 2 };
    const { wrapper } = await open("b");
    expect(stepCounter(wrapper)).toEqual([3, 3]);
    expect(wrapper.text()).toContain("Je gaat verder bij stap 3.");
  });

  it("starts a finished lesson from the top", async () => {
    progress.units.b = { status: "completed", stepIndex: 2 };
    const { wrapper } = await open("b");
    expect(stepCounter(wrapper)).toEqual([1, 3]);
  });

  it("does not run past the end when the lesson got shorter since the progress was saved", async () => {
    progress.units.b = { status: "in_progress", stepIndex: 40 };
    const { wrapper } = await open("b");
    expect(stepCounter(wrapper)).toEqual([3, 3]);
  });

  it("shows the error when the lesson cannot be loaded", async () => {
    fakeApi.fail("GET", "/units/zzz", "Les niet gevonden.");
    const { wrapper } = await open("zzz");
    expect(wrapper.text()).toContain("Les niet gevonden.");
  });
});

describe("moving through the steps", () => {
  it("'Volgende' and 'Vorige' move one step and save the position each time", async () => {
    const { wrapper } = await open("b");
    await clickButton(wrapper, "Volgende");
    await clickButton(wrapper, "Volgende");
    await clickButton(wrapper, "Vorige");
    expect(stepCounter(wrapper)).toEqual([2, 3]);
    expect(stepPosts()).toEqual([{ stepIndex: 1 }, { stepIndex: 2 }, { stepIndex: 1 }]);
  });

  it("'Stoppen' on the first step leaves for the module page", async () => {
    const { wrapper, router } = await open("b");
    await clickButton(wrapper, "Stoppen");
    expect(router.currentRoute.value.path).toBe("/module/m");
  });

  it("the last lesson step says 'Afronden'", async () => {
    const { wrapper } = await open("a");
    expect(buttonWith(wrapper, "Afronden")).toBeDefined();
    expect(buttonWith(wrapper, "Volgende")).toBeUndefined();
  });

  it("an exercise step moves on when the exercise reports it is done", async () => {
    progress.units.c = { status: "in_progress", stepIndex: 1 };
    const { wrapper } = await open("c");
    expect(wrapper.text()).toContain("stub-c-q1");
    await clickButton(wrapper, "stub-c-q1");
    expect(wrapper.text()).toContain("stub-c-q2");
  });
});

describe("finishing a lesson", () => {
  async function finish(id: string, scored: Record<string, boolean>) {
    for (const [k, v] of Object.entries(scored)) progress.items[k] = { lastCorrect: v };
    progress.units[id] = { status: "in_progress", stepIndex: 2 };
    const m = await open(id);
    await clickButton(m.wrapper, "stub-c-q2");
    return m;
  }

  it("saves the score and congratulates a pass", async () => {
    const { wrapper } = await finish("c", { "c-q1": true, "c-q2": true });
    expect(fakeApi.to("POST", "/units/c/complete")[0].body).toEqual({ score: 1 });
    expect(wrapper.text()).toContain("Je score: 2 van 2 (100%)");
    expect(wrapper.text()).toContain("Goed gedaan! Je hebt deze les gehaald.");
    expect(wrapper.text()).toContain("🎉");
  });

  it("exactly the pass mark is a pass", async () => {
    progress.items["d-q1"] = { lastCorrect: true };
    progress.items["d-q2"] = { lastCorrect: false };
    progress.units.d = { status: "in_progress", stepIndex: 1 };
    const { wrapper } = await open("d");
    await clickButton(wrapper, "stub-d-q2");
    expect(wrapper.text()).toContain("Je score: 1 van 2 (50%)");
    expect(wrapper.text()).toContain("Goed gedaan! Je hebt deze les gehaald.");
  });

  it("encourages a retry below the pass mark", async () => {
    const { wrapper } = await finish("c", { "c-q1": true, "c-q2": false });
    expect(fakeApi.to("POST", "/units/c/complete")[0].body).toEqual({ score: 0.5 });
    expect(wrapper.text()).toContain("Bijna! Probeer de les nog een keer.");
    expect(wrapper.text()).toContain("💪");
  });

  it("offers the next lesson of the module, but not after the last one", async () => {
    const mid = await open("a");
    await clickButton(mid.wrapper, "Afronden");
    expect(mid.wrapper.find("a[href='/unit/b']").text()).toContain("Volgende les: Les B");

    const last = await finish("c", { "c-q1": true, "c-q2": true });
    expect(last.wrapper.text()).not.toContain("Volgende les");
  });

  it("lists the hard questions of this lesson only when there are some, and announces new word cards", async () => {
    fakeApi.on("GET", /^\/practice\?mode=hard&unit=c$/, [mc("x"), mc("y")]);
    fakeApi.on("POST", "/units/c/complete", { wordsIntroduced: 4 });
    const { wrapper } = await finish("c", { "c-q1": true, "c-q2": true });
    expect(wrapper.text()).toContain("Moeilijke vragen (2)");
    expect(wrapper.text()).toContain("4 nieuwe woordkaartjes");
  });

  it("a lesson without hard questions or new words shows neither", async () => {
    const { wrapper } = await finish("c", { "c-q1": true, "c-q2": true });
    expect(wrapper.text()).not.toContain("Moeilijke vragen");
    expect(wrapper.text()).not.toContain("woordkaartjes");
  });

  it("'Afronden' pressed twice quickly completes the lesson once", async () => {
    // e.g. key repeat on Enter, or a double tap, while the first save is still running
    const pending = deferred<{ wordsIntroduced: number }>();
    fakeApi.on("POST", "/units/a/complete", () => pending.promise);
    const { wrapper } = await open("a");
    const button = buttonWith(wrapper, "Afronden")!;
    await button.trigger("click");
    await button.trigger("click");
    pending.resolve({ wordsIntroduced: 3 });
    await flushPromises();
    expect(fakeApi.to("POST", "/units/a/complete")).toHaveLength(1);
    expect(wrapper.text()).toContain("3 nieuwe woordkaartjes");
  });

  it("'Opnieuw' starts the lesson over from step 1", async () => {
    const { wrapper } = await finish("c", { "c-q1": true, "c-q2": true });
    progress.units.c = { status: "completed", stepIndex: 2 };
    await clickButton(wrapper, "Opnieuw");
    expect(stepCounter(wrapper)).toEqual([1, 3]);
    expect(wrapper.text()).not.toContain("Les klaar!");
    expect(stepPosts().at(-1)).toEqual({ stepIndex: 0 });
  });

  it("'Terug naar de module' goes to the module page", async () => {
    const { wrapper, router } = await finish("c", { "c-q1": true, "c-q2": true });
    await clickButton(wrapper, "Terug naar de module");
    expect(router.currentRoute.value.path).toBe("/module/m");
  });
});

describe("moving to another lesson while this page is open", () => {
  it("'Volgende les' starts that lesson instead of repeating the end screen", async () => {
    const { wrapper, router } = await open("a");
    await clickButton(wrapper, "Afronden");
    expect(wrapper.text()).toContain("Les klaar!");
    await wrapper.find("a[href='/unit/b']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/unit/b");
    expect(wrapper.text()).not.toContain("Les klaar!");
    expect(stepCounter(wrapper)).toEqual([1, 3]);
    expect(wrapper.text()).toContain("Les B");
  });

  it("browser back/forward between lessons loads the right lesson each time", async () => {
    const { wrapper, router } = await open("a");
    await router.push("/unit/b");
    await flushPromises();
    expect(wrapper.text()).toContain("Les B");
    router.back();
    await flushPromises();
    expect(wrapper.text()).toContain("Les A");
    expect(fakeApi.to("GET", "/units/a")).toHaveLength(2);
  });

  it("a lesson opened this way resumes at its own saved step, not at the position of the previous lesson", async () => {
    progress.units.c = { status: "in_progress", stepIndex: 1 };
    const { wrapper, router } = await open("b");
    await clickButton(wrapper, "Volgende");
    await clickButton(wrapper, "Volgende");
    expect(stepCounter(wrapper)).toEqual([3, 3]);
    await router.push("/unit/c");
    await flushPromises();
    expect(stepCounter(wrapper)).toEqual([2, 3]);
    expect(wrapper.text()).toContain("Je gaat verder bij stap 2.");
  });
});
