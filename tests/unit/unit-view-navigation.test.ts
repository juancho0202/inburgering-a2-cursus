// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import UnitView from "../../src/views/UnitView.vue";

const lessonUnit = (id: string, title: string) => ({
  id, moduleId: "m", title, goal: `Doel ${id}`, estimatedMinutes: 5, tags: [], vocabRefs: [], passScore: 0.7,
  steps: [{ type: "lesson", id: `${id}-l-01`, title: `Stap ${id}`, blocks: [] }],
});
const units: Record<string, ReturnType<typeof lessonUnit>> = { a: lessonUnit("a", "Les A"), b: lessonUnit("b", "Les B") };
units.c = lessonUnit("c", "Les C");
units.c.steps.push({ type: "lesson", id: "c-l-02", title: "Stap c2", blocks: [] }, { type: "lesson", id: "c-l-03", title: "Stap c3", blocks: [] });
let savedUnits: Record<string, unknown> = {};

const get = vi.fn(async (path: string) => {
  if (path.startsWith("/units/")) return units[path.split("/")[2]];
  if (path === "/progress") return { units: savedUnits, items: {} };
  if (path === "/course") return { modules: [{ id: "m", units: [{ id: "a", title: "Les A" }, { id: "b", title: "Les B" }] }] };
  return [];
});
vi.mock("../../src/api/client", () => ({
  api: { get: (p: string) => get(p), post: vi.fn(async () => ({ wordsIntroduced: 0 })) },
}));

async function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/unit/:id", component: UnitView }, { path: "/:p(.*)*", component: { template: "<i/>" } }] });
  router.push("/unit/a");
  await router.isReady();
  const wrapper = mount({ template: "<RouterView />" }, {
    global: { plugins: [createPinia(), router], stubs: { LessonBlocks: true, ReportIssue: true, ExerciseShell: true } },
  });
  await flushPromises();
  return { router, wrapper };
}
const button = (w: Awaited<ReturnType<typeof setup>>["wrapper"], text: string) => w.findAll("button").find((b) => b.text().includes(text))!;

describe("UnitView navigation", () => {
  beforeEach(() => {
    get.mockClear();
    savedUnits = {};
  });

  it.each(["in_progress", "completed"])("resumes at the saved step of a %s lesson", async (status) => {
    savedUnits = { c: { status, stepIndex: 2, bestScore: 1, attempts: 1, completedAt: null } };
    const { router, wrapper } = await setup();
    await router.push("/unit/c");
    await flushPromises();
    expect(wrapper.text()).toContain("Stap c3");
    expect(wrapper.text()).toContain("3 / 3");
  });

  it("starts a completed lesson at the beginning when no step was saved", async () => {
    savedUnits = { c: { status: "completed", stepIndex: 0, bestScore: 1, attempts: 1, completedAt: "x" } };
    const { router, wrapper } = await setup();
    await router.push("/unit/c");
    await flushPromises();
    expect(wrapper.text()).toContain("1 / 3");
  });

  it("starts the next lesson when 'Volgende les' is used after finishing one", async () => {
    const { router, wrapper } = await setup();
    await button(wrapper, "Afronden").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Les klaar!");

    await wrapper.find("a[href='/unit/b']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/unit/b");
    expect(wrapper.text()).not.toContain("Les klaar!");
    expect(wrapper.text()).toContain("Les B");
    expect(wrapper.text()).toContain("Stap b");
  });

  it("loads the unit data again for the new id", async () => {
    const { router, wrapper } = await setup();
    await router.push("/unit/b");
    await flushPromises();
    expect(get).toHaveBeenCalledWith("/units/b");
    expect(wrapper.text()).toContain("Stap b");
  });
});
