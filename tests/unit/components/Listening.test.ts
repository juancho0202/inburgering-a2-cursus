// @vitest-environment jsdom
// Listening fragments: the player (recording, device voice, nothing), the exercise around it, and the shell.
// The recording is played by a stand-in for the browser's Audio element; time passes when a test says so.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import FragmentPlayer from "../../../src/components/FragmentPlayer.vue";
import ListeningExercise from "../../../src/components/exercises/ListeningExercise.vue";
import ExerciseShell from "../../../src/components/exercises/ExerciseShell.vue";
import { forgetFragmentTimings } from "../../../src/composables/useFragmentPlayer";
import { stopSpeech } from "../../../src/composables/useSpeech";
import { fragmentKey } from "../../../src/lib/fragments";
import { useSettingsStore } from "../../../src/stores/settings";
import { buttonWith, clickButton, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const fragment = {
  kind: "telefoon" as const,
  situation: "Yusuf belt de huisarts.",
  speakers: [
    { name: "Assistente", voice: "nathalie" as const, phone: true },
    { name: "Yusuf", voice: "ronnie" as const },
  ],
  lines: [
    { speaker: "Assistente", nl: "Huisartsenpraktijk De Linde, goedemorgen." },
    { speaker: "Yusuf", nl: "Kan ik vandaag komen?" },
    { speaker: "Assistente", nl: "Vandaag is vol. Morgen om kwart over elf kan wel." },
    { speaker: "Yusuf", nl: "Goed. Tot morgen." },
  ],
};
// The ring tone first, then the four lines.
const TIMING = { duration: 14, starts: [3, 5.5, 8, 12] };

class FakeAudio {
  static all: FakeAudio[] = [];
  currentTime = 0;
  duration = NaN;
  paused = true;
  ended = false;
  playbackRate = 1;
  preload = "";
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  /** Time passes in the recording. */
  at(seconds: number) {
    this.currentTime = seconds;
    this.ontimeupdate?.();
  }
}
const audio = () => FakeAudio.all.at(-1)!;

/** The recorded fragments the app finds (none: an empty list). */
function recordings(fragments: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes("fragments") ? { fragments } : { keys: [] }) })),
  );
  forgetFragmentTimings();
}

/** A device voice that says each line at once and remembers what it said, with which pitch. */
function deviceVoice() {
  const said: { text: string; pitch: number }[] = [];
  vi.stubGlobal("SpeechSynthesisUtterance", class {
    lang = "";
    voice: unknown = null;
    pitch = 1;
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  });
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [{ lang: "nl-NL", name: "Xander", localService: true }],
    addEventListener: () => {},
    cancel: vi.fn(),
    speak: (u: { text: string; pitch: number; onend: () => void }) => {
      said.push({ text: u.text, pitch: u.pitch });
      queueMicrotask(() => u.onend());
    },
  });
  return said;
}

const mountPlayer = (props: Record<string, unknown> = {}) => mountApp(FragmentPlayer, { props: { fragment, ...props } }).then((m) => m.wrapper);
const textShown = (w: VueWrapper) => w.text().includes("Kan ik vandaag komen?");
const sentence = (w: VueWrapper, words: string) => w.findAll("li button").find((b) => b.text().includes(words))!;

beforeEach(() => {
  fakeApi.reset();
  FakeAudio.all = [];
  vi.stubGlobal("Audio", FakeAudio);
  recordings({ [fragmentKey(fragment)]: TIMING });
});
afterEach(() => {
  stopSpeech();
  vi.unstubAllGlobals();
});

describe("FragmentPlayer with a recording", () => {
  it("plays the recording of this fragment, and pauses it", async () => {
    const w = await mountPlayer();
    await clickButton(w, "Luister");
    expect(audio().src).toBe(`/audio/fragments/${fragmentKey(fragment)}.m4a`);
    expect(audio().play).toHaveBeenCalledTimes(1);
    expect(buttonWith(w, "Pauze")!.attributes("aria-pressed")).toBe("true");
    audio().at(4);
    await clickButton(w, "Pauze");
    expect(audio().paused).toBe(true);
    expect(buttonWith(w, "Verder")).toBeTruthy();
  });

  it("follows the playback speed setting", async () => {
    const m = await mountApp(FragmentPlayer, { props: { fragment } });
    useSettingsStore(m.pinia).settings = { speechRate: 0.76 } as any;
    await clickButton(m.wrapper, "Luister");
    expect(audio().playbackRate).toBeCloseTo(0.8);
  });

  it("keeps the text hidden while answering, unless the learner cannot listen now", async () => {
    const w = await mountPlayer();
    expect(textShown(w)).toBe(false);
    await clickButton(w, "Ik kan nu niet luisteren");
    expect(textShown(w)).toBe(true);
  });

  it("offers no way to read the text in an exam", async () => {
    const w = await mountPlayer({ allowPeek: false });
    expect(buttonWith(w, "Ik kan nu niet luisteren")).toBeUndefined();
    expect(textShown(w)).toBe(false);
  });

  it("marks the line being said, and none during the ring tone", async () => {
    const w = await mountPlayer({ showText: true });
    await clickButton(w, "Luister");
    audio().at(1);
    await flushPromises();
    expect(w.findAll("[aria-current=true]")).toHaveLength(0);
    audio().at(9);
    await flushPromises();
    expect(w.find("[aria-current=true]").text()).toContain("Morgen om kwart over elf");
  });

  it("plays from a line when the learner taps it in the text", async () => {
    const w = await mountPlayer({ showText: true });
    await sentence(w, "Morgen om kwart over elf").trigger("click");
    await flushPromises();
    expect(audio().currentTime).toBe(8);
    expect(audio().paused).toBe(false);
  });

  it("goes back to the start of the line being said, or to the line before when it has just begun", async () => {
    const w = await mountPlayer();
    await clickButton(w, "Luister");
    audio().at(10.5); // 2.5 s into line 3
    await clickButton(w, "Zin terug");
    expect(audio().currentTime).toBe(8);
    audio().at(8.5); // just begun
    await clickButton(w, "Zin terug");
    expect(audio().currentTime).toBe(5.5);
  });

  it("starts again from the very beginning (with the ring tone) after the end", async () => {
    const w = await mountPlayer();
    await clickButton(w, "Luister");
    audio().at(14);
    audio().ended = true;
    audio().onended!();
    await flushPromises();
    await clickButton(w, "Luister");
    expect(audio().currentTime).toBe(0);
  });

  it("stops when the lesson voice starts (and the voice stops when it starts)", async () => {
    const w = await mountPlayer();
    await clickButton(w, "Luister");
    stopSpeech(); // what every read-aloud and every check does first
    await flushPromises();
    expect(audio().paused).toBe(true);
    expect(buttonWith(w, "Pauze")).toBeUndefined();
  });

  it("stops the sound when it is removed, and ignores the recording after that", async () => {
    const w = await mountPlayer({ showText: true });
    await clickButton(w, "Luister");
    const a = audio();
    w.unmount();
    expect(a.paused).toBe(true);
    expect(a.ontimeupdate).toBeNull();
  });

  it("reads the lines with the device's voice when the recording cannot be loaded", async () => {
    const said = deviceVoice();
    const w = await mountPlayer();
    await clickButton(w, "Luister");
    audio().onerror!();
    await flushPromises();
    expect(said.map((s) => s.text)[0]).toBe("Huisartsenpraktijk De Linde, goedemorgen.");
  });
});

describe("FragmentPlayer without a recording", () => {
  it("reads every line in order with the device's voice, each person at their own pitch", async () => {
    recordings({});
    const said = deviceVoice();
    const w = await mountPlayer();
    await clickButton(w, "Luister");
    await flushPromises();
    expect(said.map((s) => s.text)).toEqual(fragment.lines.map((l) => l.nl));
    expect(said[0].pitch).not.toBe(said[1].pitch);
    expect(said[0].pitch).toBe(said[2].pitch);
    expect(FakeAudio.all).toHaveLength(0);
  });

  it("shows the text when the device cannot speak at all", async () => {
    recordings({});
    const w = await mountPlayer();
    expect(w.text()).toContain("Dit apparaat kan het fragment niet afspelen");
    expect(textShown(w)).toBe(true);
    expect(buttonWith(w, "Luister")!.attributes("disabled")).toBeDefined();
  });
});

const base = { tags: ["luisteren:telefoon"], explanation: "Uitleg", difficulty: 1 as const };
const exercise = {
  ...base,
  id: "l-1",
  type: "listening" as const,
  prompt: "Lees eerst de vragen. Luister dan naar het telefoongesprek.",
  fragment,
  explanation: "De eerste tijd past niet.",
  questions: [
    { ...base, id: "l-1-1", type: "mc" as const, prompt: "Wanneer gaat Yusuf?", options: ["Vandaag", "Morgen"], answer: 1, explanation: "Vandaag is vol.", answerLine: 2 },
    { ...base, id: "l-1-2", type: "mc" as const, prompt: "Wie neemt op?", options: ["De assistente", "De dokter"], answer: 0, explanation: "Huisartsenpraktijk De Linde.", answerLine: 0 },
  ],
};
type Handle = { ready: boolean; evaluate: () => any };
const pick = (w: VueWrapper, label: string) => w.findAll("button").find((b) => b.text() === label)!.trigger("click");

describe("ListeningExercise", () => {
  it("is ready when every question has an answer, and scores each question under its own id", async () => {
    const w = (await mountApp(ListeningExercise, { props: { exercise, checked: false } })).wrapper;
    await pick(w, "Morgen");
    expect((w.vm as unknown as Handle).ready).toBe(false);
    await pick(w, "De dokter");
    const h = w.vm as unknown as Handle;
    expect(h.ready).toBe(true);
    expect(h.evaluate()).toMatchObject({
      correct: false,
      score: 0.5,
      correctAnswer: "1 van 2 goed",
      parts: [
        { itemId: "l-1-1", correct: true, answer: 1 },
        { itemId: "l-1-2", correct: false, answer: 1 },
      ],
    });
  });

  it("shows no text and no explanations before checking", async () => {
    const w = (await mountApp(ListeningExercise, { props: { exercise, checked: false } })).wrapper;
    expect(textShown(w)).toBe(false);
    expect(w.text()).not.toContain("Vandaag is vol.");
    expect(buttonWith(w, "Luister naar het antwoord")).toBeUndefined();
  });

  it("after checking shows the text with where each answer is said, and plays a question's answer", async () => {
    const w = (await mountApp(ListeningExercise, { props: { exercise, checked: true } })).wrapper;
    expect(textShown(w)).toBe(true);
    expect(sentence(w, "Morgen om kwart over elf").text()).toContain("Vraag 1");
    expect(sentence(w, "goedemorgen").text()).toContain("Vraag 2");
    expect(w.text()).toContain("Vandaag is vol.");
    const answerButtons = w.findAll("button").filter((b) => b.text().includes("Luister naar het antwoord"));
    await answerButtons[0].trigger("click");
    await flushPromises();
    expect(audio().currentTime).toBe(8);
  });
});

describe("a listening exercise in the shell", () => {
  async function mountShell() {
    fakeApi.on("POST", "/attempts", {});
    const m = await mountApp(ExerciseShell, { props: { exercise } });
    useSettingsStore(m.pinia).settings = { apiKey: null } as any;
    await flushPromises();
    return m.wrapper;
  }

  it("saves one attempt per question and stops the fragment when the answers are checked", async () => {
    const w = await mountShell();
    await clickButton(w, "Luister");
    await pick(w, "Morgen");
    await pick(w, "De assistente");
    await clickButton(w, "Controleer");
    expect(audio().paused).toBe(true);
    expect(fakeApi.to("POST", "/attempts").map((c) => c.body)).toMatchObject([
      { itemId: "l-1-1", exerciseType: "listening", correct: true, answer: 1 },
      { itemId: "l-1-2", exerciseType: "listening", correct: true, answer: 0 },
    ]);
    expect(w.text()).toContain("De eerste tijd past niet.");
  });
});
