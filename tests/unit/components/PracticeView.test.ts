// @vitest-environment jsdom
// Free practice: hard questions, a topic, mistakes from an exam, and exercises made by Claude.
import { beforeEach, describe, expect, it, vi } from "vitest";
import PracticeView from "../../../src/views/PracticeView.vue";
import { buttonWith, clickButton, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const mc = (id: string) => ({ id, type: "mc", tags: ["t"], prompt: "Vraag", options: ["a", "b"], answer: 0, explanation: "e", difficulty: 1 });
// ExerciseShell has its own tests: here it shows the exercise id and lets the test answer right or wrong.
const ShellStub = {
  props: ["exercise", "isLast"],
  emits: ["done", "exit"],
  template: `<div>
    <p>{{ exercise.id }}{{ isLast ? " (laatste)" : "" }}</p>
    <button @click="$emit('done', { correct: true, score: 1, answer: 0 })">goed</button>
    <button @click="$emit('done', { correct: false, score: 0, answer: 1 })">fout</button>
    <button @click="$emit('exit')">stop</button>
  </div>`,
};

let hasKey = false;
beforeEach(() => {
  fakeApi.reset();
  hasKey = false;
  fakeApi.on("GET", "/settings", () => ({ apiKey: hasKey ? "sk-ant-x" : null }));
});
const open = (url: string) => mountApp(PracticeView, { routePath: "/oefenen", url, stubs: { ExerciseShell: ShellStub } });

describe("what is practised", () => {
  it("passes the query on to the practice endpoint (hard questions of one lesson)", async () => {
    fakeApi.on("GET", "/practice?mode=hard&unit=basis-a", [mc("q1")]);
    const { wrapper } = await open("/oefenen?mode=hard&unit=basis-a");
    expect(wrapper.text()).toContain("Moeilijke vragen");
    expect(wrapper.text()).toContain("q1");
  });

  it("practising a topic is titled after the topic", async () => {
    fakeApi.on("GET", "/practice?tag=grammar%3Averleden-tijd", [mc("q1")]);
    const { wrapper } = await open("/oefenen?tag=grammar:verleden-tijd");
    expect(wrapper.text()).toContain("Oefen: grammar · verleden-tijd");
  });

  it("'Oefen je fouten' loads the mistakes of that exam", async () => {
    fakeApi.on("GET", "/exams/results/res-9/mistakes", [mc("q1")]);
    const { wrapper } = await open("/oefenen?exam=res-9");
    expect(wrapper.text()).toContain("Oefen je fouten");
  });

  it("nothing to practise gives a friendly message, not an empty page", async () => {
    fakeApi.on("GET", /^\/practice/, []);
    const { wrapper } = await open("/oefenen?mode=hard");
    expect(wrapper.text()).toContain("Geen vragen om te oefenen. Goed bezig!");
  });

  it("shows the error when loading fails", async () => {
    fakeApi.fail("GET", /^\/practice/, "Kon de vragen niet laden.");
    const { wrapper } = await open("/oefenen?mode=hard");
    expect(wrapper.text()).toContain("Kon de vragen niet laden.");
  });
});

describe("going through the questions", () => {
  beforeEach(() => fakeApi.on("GET", /^\/practice/, [mc("q1"), mc("q2"), mc("q3")]));

  it("shows one question at a time with progress, marks the last one, and ends with the number right", async () => {
    const { wrapper } = await open("/oefenen?mode=hard");
    expect(wrapper.text()).toContain("1 / 3");
    await clickButton(wrapper, "goed");
    expect(wrapper.text()).toContain("q2");
    await clickButton(wrapper, "fout");
    expect(wrapper.text()).toContain("q3 (laatste)");
    await clickButton(wrapper, "goed");
    expect(wrapper.text()).toContain("Klaar!");
    expect(wrapper.text()).toContain("Je score: 2 van 3");
  });

  it("'stop' goes back to the start page", async () => {
    const { wrapper, router } = await open("/oefenen?mode=hard");
    await clickButton(wrapper, "stop");
    expect(router.currentRoute.value.path).toBe("/");
  });
});

describe("'Meer oefenen met Claude'", () => {
  it("without an API key it explains where to add one and does not ask for exercises", async () => {
    const { wrapper } = await open("/oefenen?gen=unit&unit=basis-a");
    expect(wrapper.text()).toContain("Voeg een API-sleutel toe");
    expect(wrapper.find("a[href='/instellingen']").exists()).toBe(true);
    expect(buttonWith(wrapper, "Maak oefeningen")).toBeUndefined();
    expect(fakeApi.calls.filter((c) => c.path.startsWith("/practice") || c.path === "/claude/generate")).toHaveLength(0);
  });

  it("asks Claude for the chosen kind and number for this lesson, then practises them", async () => {
    hasKey = true;
    fakeApi.on("POST", "/claude/generate", { exercises: [mc("gen-1"), mc("gen-2")] });
    const { wrapper } = await open("/oefenen?gen=unit&unit=basis-a");
    await clickButton(wrapper, "Invullen");
    await wrapper.find("input[type=range]").setValue(8);
    await clickButton(wrapper, "Maak oefeningen");
    expect(fakeApi.to("POST", "/claude/generate")[0].body).toEqual({ unitId: "basis-a", type: "gap-fill", count: 8 });
    expect(wrapper.text()).toContain("gen-1");
    expect(wrapper.text()).toContain("1 / 2");
  });

  it("from the dashboard (a weak topic) it asks by tag instead of by lesson", async () => {
    hasKey = true;
    fakeApi.on("POST", "/claude/generate", { exercises: [mc("gen-1")] });
    const { wrapper } = await open("/oefenen?gen=tag&tag=grammar:de-het");
    await clickButton(wrapper, "Maak oefeningen");
    expect(fakeApi.to("POST", "/claude/generate")[0].body).toEqual({ tag: "grammar:de-het", type: "mc", count: 6 });
  });

  it("a failed request shows the reason and lets the learner try again", async () => {
    hasKey = true;
    fakeApi.fail("POST", "/claude/generate", "Claude is even niet bereikbaar.");
    const { wrapper } = await open("/oefenen?gen=unit&unit=basis-a");
    await clickButton(wrapper, "Maak oefeningen");
    expect(wrapper.text()).toContain("Claude is even niet bereikbaar.");
    expect(buttonWith(wrapper, "Maak oefeningen")!.attributes("disabled")).toBeUndefined();
  });

  it("the button is disabled while Claude is working, so the request is not sent twice", async () => {
    hasKey = true;
    let release!: (v: unknown) => void;
    fakeApi.on("POST", "/claude/generate", () => new Promise((r) => (release = r)));
    const { wrapper } = await open("/oefenen?gen=unit&unit=basis-a");
    await buttonWith(wrapper, "Maak oefeningen")!.trigger("click");
    expect(buttonWith(wrapper, "Maak oefeningen")!.attributes("disabled")).toBeDefined();
    await buttonWith(wrapper, "Maak oefeningen")!.trigger("click");
    expect(fakeApi.to("POST", "/claude/generate")).toHaveLength(1);
    release({ exercises: [mc("gen-1")] });
    await flushPromises();
  });
});
