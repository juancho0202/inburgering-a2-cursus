// @vitest-environment jsdom
// What the lesson player says when a lesson opens (the voice reads each step by itself; see stepSegments).
import { beforeEach, describe, expect, it, vi } from "vitest";
import UnitView from "../../../src/views/UnitView.vue";
import { clickButton, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

// A Dutch device voice, there before the app loads (useSpeech picks its voice then). It says each line at once and
// remembers it. No recorded clips: the manifest cannot be fetched in jsdom, so every line goes to this voice.
const said = vi.hoisted(() => {
  const lines: string[] = [];
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      lang = "";
      voice: unknown = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [{ lang: "nl-NL", name: "Xander", localService: true }],
    addEventListener: () => {},
    cancel: () => {},
    speak: (u: { text: string; onend: () => void }) => {
      lines.push(u.text);
      queueMicrotask(() => u.onend());
    },
  });
  return lines;
});

const unit = (title: string, firstTitle: string) => ({
  id: "b", moduleId: "m", title, goal: "Je kiest met regels.", estimatedMinutes: 5, tags: [], vocabRefs: [], passScore: 0.7,
  steps: [
    { type: "lesson", id: "b-l1", title: firstTitle, blocks: [] },
    { type: "lesson", id: "b-l2", title: "Meervoud", blocks: [] },
  ],
});
const course = { modules: [{ id: "m", units: [{ id: "a", title: "Les A" }, { id: "b", title: "De of het" }] }] };

let current: ReturnType<typeof unit>;
beforeEach(() => {
  said.length = 0;
  fakeApi.reset();
  fakeApi.on("GET", "/progress", { units: {}, items: {} });
  fakeApi.on("GET", "/course", course);
  fakeApi.on("GET", "/units/b", () => current);
  fakeApi.on("POST", "/units/b/step", {});
});

async function open(title: string, firstTitle: string) {
  current = unit(title, firstTitle);
  const { wrapper } = await mountApp(UnitView, { routePath: "/unit/:id", url: "/unit/b", stubs: { LessonBlocks: true, ReportIssue: true } });
  await flushPromises();
  return wrapper;
}

describe("opening a lesson", () => {
  it("names the lesson once when its first step has the same title, with a question mark", async () => {
    await open("De of het", "De of het?");
    expect(said).toEqual(["Les 2. De of het.", "Je kiest met regels."]);
  });

  it("says the first step's title after the lesson's name when it is another title", async () => {
    await open("De of het", "Lidwoorden");
    expect(said).toEqual(["Les 2. De of het. Lidwoorden", "Je kiest met regels."]);
  });

  it("reads a later step's title even when it is the lesson's name", async () => {
    const wrapper = await open("De of het", "De of het?");
    current.steps[1].title = "De of het?";
    said.length = 0;
    await clickButton(wrapper, "Volgende");
    await flushPromises();
    expect(said).toEqual(["De of het?"]);
  });
});
