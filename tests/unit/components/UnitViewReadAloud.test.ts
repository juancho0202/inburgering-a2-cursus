// @vitest-environment jsdom
// What the lesson player says when a lesson opens (the voice reads each step by itself; see stepSegments), and that
// it reads along with the reader: a part below the screen waits until they scroll to it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const text = (md: string) => ({ kind: "text", md });
const unit = (title: string, firstTitle: string, blocks: unknown[] = []) => ({
  id: "b", moduleId: "m", title, goal: "Je kiest met regels.", estimatedMinutes: 5, tags: [], vocabRefs: [], passScore: 0.7,
  steps: [
    { type: "lesson", id: "b-l1", title: firstTitle, blocks },
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

async function open(title: string, firstTitle: string, blocks: unknown[] = []) {
  current = unit(title, firstTitle, blocks);
  const { wrapper } = await mountApp(UnitView, { routePath: "/unit/:id", url: "/unit/b", stubs: { ReportIssue: true } });
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

// jsdom lays nothing out: each part of the lesson gets a place on a long page (px from its top), and `scrolled` is how
// far the reader scrolled. The screen is jsdom's 768 px high; the bar fixed at its bottom covers it from 700 px.
let scrolled = 0;
const placeOnPage: Record<string, number> = { heading: 0, goal: 60, "block-0": 120, "block-1": 1500, "block-2": 2400 };
function scrollTo(y: number) {
  scrolled = y;
  window.dispatchEvent(new Event("scroll"));
}

describe("reading along with the reader", () => {
  const blocks = [text("Eerst dit."), text("Dan dit, verder naar beneden."), text("En dit, onderaan.")];

  beforeEach(() => {
    scrolled = 0;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const id = this.getAttribute("data-read");
      const bar = this.classList.contains("fixed");
      const top = bar ? 700 : id && id in placeOnPage ? placeOnPage[id] - scrolled : 0;
      const height = bar ? 68 : id ? 60 : 0;
      return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("does not read a part below the screen until the reader scrolls to it", async () => {
    await open("De of het", "Lidwoorden", blocks);
    expect(said).toEqual(["Les 2. De of het. Lidwoorden", "Je kiest met regels.", "Eerst dit."]);
    scrollTo(400); // block 1 is at 1100: still under the screen
    await flushPromises();
    expect(said).toHaveLength(3);
    scrollTo(790); // at 710: on the screen, but behind the bar
    await flushPromises();
    expect(said).toHaveLength(3);
    scrollTo(820); // at 680: only 20 px above the bar, less than its first line
    await flushPromises();
    expect(said).toHaveLength(3);
    scrollTo(900); // at 600: its first line is in sight
    await flushPromises();
    expect(said.slice(3)).toEqual(["Dan dit, verder naar beneden."]);
  });

  it("reads everything the reader scrolled to or past, at once", async () => {
    await open("De of het", "Lidwoorden", blocks);
    scrollTo(3000); // to the bottom: both parts are above the screen now
    await flushPromises();
    expect(said.slice(3)).toEqual(["Dan dit, verder naar beneden.", "En dit, onderaan."]);
  });

  it("stops waiting when the reader stops the read-along, and reads nothing when they scroll on", async () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const wrapper = await open("De of het", "Lidwoorden", blocks);
    expect(added.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(1);
    await clickButton(wrapper, "Stop");
    // the scroll and resize listeners of the wait are gone at once, not at the next scroll
    for (const type of ["scroll", "resize"]) {
      const listener = added.mock.calls.find(([t]) => t === type)![1];
      expect(removed.mock.calls.some(([t, l]) => t === type && l === listener), type).toBe(true);
    }
    scrollTo(3000);
    await flushPromises();
    expect(said).toHaveLength(3);
  });

  it("forgets a part it waited for when the learner goes to the next step", async () => {
    const wrapper = await open("De of het", "Lidwoorden", blocks);
    await clickButton(wrapper, "Volgende");
    await flushPromises();
    expect(said.slice(3)).toEqual(["Meervoud"]);
    scrollTo(3000);
    await flushPromises();
    expect(said.slice(3)).toEqual(["Meervoud"]);
  });

  it("starts again where it waited when the reader presses play", async () => {
    const wrapper = await open("De of het", "Lidwoorden", blocks);
    await clickButton(wrapper, "Stop");
    scrollTo(900);
    await clickButton(wrapper, "Lees voor");
    await flushPromises();
    expect(said.slice(3)).toEqual(["Dan dit, verder naar beneden."]);
  });
});
