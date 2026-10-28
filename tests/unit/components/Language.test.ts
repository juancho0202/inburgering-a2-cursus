// @vitest-environment jsdom
// The app's own languages: the first-visit picker (and /?lang= from the landing pages), how much Dutch each
// immersion level shows, labels that lose their translation once their words are learned, the Dutch-only exam,
// and feedback that is Dutch first with "In mijn taal".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import App from "../../../src/App.vue";
import UiLabel from "../../../src/components/ui/UiLabel.vue";
import UiText from "../../../src/components/ui/UiText.vue";
import LanguagePicker from "../../../src/components/LanguagePicker.vue";
import FeedbackLanguageToggle from "../../../src/components/FeedbackLanguageToggle.vue";
import ExerciseShell from "../../../src/components/exercises/ExerciseShell.vue";
import LessonBlocks from "../../../src/components/LessonBlocks.vue";
import WelcomeView from "../../../src/views/WelcomeView.vue";
import DashboardView from "../../../src/views/DashboardView.vue";
import SettingsView from "../../../src/views/SettingsView.vue";
import ExamsView from "../../../src/views/ExamsView.vue";
import { useSettingsStore } from "../../../src/stores/settings";
import { requestedLanguage, resetRequestedLanguage, takeLanguageParam } from "../../../src/i18n";
import { buttonWith, clickButton, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

type Settings = Record<string, unknown>;
let settings: Settings;
/** GET and PUT /settings like the real service: a PUT merges the patch and returns the result. */
function serveSettings(initial: Settings) {
  settings = { apiKey: null, theme: "system", immersion: 1, feedbackInMyLanguage: false, ...initial };
  fakeApi.on("GET", "/settings", () => settings);
  fakeApi.on("PUT", "/settings", (body) => (settings = { ...settings, ...(body as Settings) }));
}
const puts = () => fakeApi.to("PUT", "/settings").map((c) => c.body);

beforeEach(() => {
  fakeApi.reset();
  localStorage.clear();
  resetRequestedLanguage();
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as any;
});

/** A page with each kind of label, mounted in the real app shell (so route meta and <html lang> behave as in the app). */
const page = {
  components: { UiLabel, UiText },
  template: `<div>
    <h2 id="title"><UiLabel variant="heading" k="dashboard.practiseMore" /></h2>
    <button><UiLabel k="common.next" /></button><button><UiLabel k="common.previous" /></button>
    <span id="chip"><UiLabel variant="inline" k="vocab.new" /></span>
    <p id="prose"><UiText k="dashboard.ready" /></p>
  </div>`,
};
const routes = [
  { path: "/", component: page },
  { path: "/examen/:id", component: page, meta: { focus: true, dutchOnly: true } },
];
async function openApp(s: Settings, url = "/") {
  serveSettings(s);
  const m = await mountApp(App, { routes, url, stubs: { FinishSessionDialog: true } });
  await flushPromises();
  return m;
}
const nextButton = (w: VueWrapper) => w.findAll("main button:not(.ui-flag)")[0];
/** A button label: its Dutch line and the small line under it (null when there is none). */
const lines = (b: VueWrapper | ReturnType<VueWrapper["find"]>) => {
  const sub = b.find(".ui-sub");
  return sub.exists() ? [b.find("[lang=nl]").text(), sub.text()] : [b.text()];
};
const title = (w: VueWrapper) => w.find("#title");
const flag = (w: VueWrapper) => w.find("#title button");

describe("immersion levels (learner's language: English)", () => {
  it("level 1: buttons are Dutch with English under them, headings are Dutch with a flag, the rest is English", async () => {
    const { wrapper } = await openApp({ language: "en", immersion: 1 });
    expect(lines(nextButton(wrapper))).toEqual(["Volgende", "Next"]);
    expect(title(wrapper).text()).toContain("Dit moet je meer oefenen");
    expect(flag(wrapper).text()).toBe("🇬🇧");
    expect(wrapper.find("#chip").text()).toBe("New");
    expect(wrapper.find("#prose").text()).toBe("Ready to learn? Start with a lesson.");
    expect(document.documentElement.lang).toBe("en");
  });

  it("the flag switches only that heading to English, and back to Dutch", async () => {
    const { wrapper } = await openApp({ language: "en", immersion: 1 });
    await flag(wrapper).trigger("click");
    expect(title(wrapper).text()).toContain("Practise these more");
    expect(title(wrapper).text()).not.toContain("Dit moet je");
    expect(flag(wrapper).text()).toBe("🇳🇱");
    expect(flag(wrapper).attributes("aria-pressed")).toBe("true");
    expect(lines(nextButton(wrapper))).toEqual(["Volgende", "Next"]);

    await flag(wrapper).trigger("click");
    expect(title(wrapper).text()).toContain("Dit moet je meer oefenen");
  });

  it("level 0 shows only English, without flags", async () => {
    const { wrapper } = await openApp({ language: "en", immersion: 0 });
    expect(lines(nextButton(wrapper))).toEqual(["Next"]);
    expect(title(wrapper).text()).toBe("Practise these more");
    expect(flag(wrapper).exists()).toBe(false);
  });

  it("level 2 shows only Dutch, also the longer text, and the page says it is Dutch", async () => {
    const { wrapper } = await openApp({ language: "en", immersion: 2 });
    expect(lines(nextButton(wrapper))).toEqual(["Volgende"]);
    expect(flag(wrapper).exists()).toBe(false);
    expect(wrapper.find("#chip").text()).toBe("Nieuw");
    expect(wrapper.find("#prose").text()).toBe("Klaar om te leren? Begin met een les.");
    expect(document.documentElement.lang).toBe("nl");
  });

  it("with Dutch as the language there are no translations and no flags", async () => {
    const { wrapper } = await openApp({ language: "nl", immersion: 1 });
    expect(lines(nextButton(wrapper))).toEqual(["Volgende"]);
    expect(flag(wrapper).exists()).toBe(false);
  });

  it("works the same in Spanish", async () => {
    const { wrapper } = await openApp({ language: "es", immersion: 1 });
    expect(lines(nextButton(wrapper))).toEqual(["Volgende", "Siguiente"]);
    expect(flag(wrapper).text()).toBe("🇪🇸");
    expect(document.documentElement.lang).toBe("es");
  });
});

describe("labels that graduate to Dutch", () => {
  const vocab = (state: string) => [{ theme: "app", title: "De woorden van de app", entries: [{ id: "basis-vocab-app-001", nl: "volgende", state }] }];

  it("a button whose words are learned loses its translation; the others keep theirs", async () => {
    fakeApi.on("GET", "/vocab", vocab("learned"));
    const { wrapper } = await openApp({ language: "en", immersion: 1 });
    expect(lines(nextButton(wrapper))).toEqual(["Volgende"]);
    expect(lines(wrapper.findAll("main button:not(.ui-flag)")[1])).toEqual(["Vorige", "Previous"]);
  });

  it("at 'my language' a learned word is shown in Dutch", async () => {
    fakeApi.on("GET", "/vocab", vocab("learned"));
    const { wrapper } = await openApp({ language: "en", immersion: 0 });
    expect(lines(nextButton(wrapper))).toEqual(["Volgende"]);
    expect(lines(wrapper.findAll("main button:not(.ui-flag)")[1])).toEqual(["Previous"]);
  });

  it("a word that is still being learned keeps its translation", async () => {
    fakeApi.on("GET", "/vocab", vocab("learning"));
    const { wrapper } = await openApp({ language: "en", immersion: 1 });
    expect(lines(nextButton(wrapper))).toEqual(["Volgende", "Next"]);
  });

  it("the word list is not loaded when everything is Dutch anyway (level 2)", async () => {
    fakeApi.on("GET", "/vocab", vocab("learned"));
    await openApp({ language: "en", immersion: 2 });
    expect(fakeApi.to("GET", "/vocab")).toHaveLength(0);
  });
});

describe("the mock exam is Dutch only", () => {
  it("shows only Dutch there, even at 'my language', and the English comes back after the exam", async () => {
    const { wrapper, router } = await openApp({ language: "en", immersion: 0 }, "/examen/e1");
    expect(nextButton(wrapper).text()).toBe("Volgende");
    expect(document.documentElement.lang).toBe("nl");

    await router.push("/");
    await flushPromises();
    expect(nextButton(wrapper).text()).toBe("Next");
    expect(document.documentElement.lang).toBe("en");
  });

  it("the exams page says so, in the learner's own language, before the exam starts", async () => {
    serveSettings({ language: "en", immersion: 2 });
    fakeApi.on("GET", "/exams", []);
    const { wrapper } = await mountApp(ExamsView);
    await useSettingsStore().load();
    await flushPromises();
    expect(wrapper.text()).toContain("The exam is completely in Dutch, just like the real exam.");
  });
});

describe("choosing a language", () => {
  it("the picker saves the choice and the app switches to it at once", async () => {
    serveSettings({ language: "en" });
    const { wrapper } = await mountApp({ components: { LanguagePicker, UiLabel }, template: `<div><LanguagePicker /><button><UiLabel k="common.next" /></button></div>` });
    await useSettingsStore().load();
    await flushPromises();

    await clickButton(wrapper, "Español");
    expect(puts()).toEqual([{ language: "es" }]);
    expect(wrapper.find("[role=radio][aria-checked=true]").text()).toBe("Español");
    expect(lines(buttonWith(wrapper, "Volgende")!)).toEqual(["Volgende", "Siguiente"]);
    // so the next visit starts in Spanish before the settings are loaded
    expect(localStorage.getItem("uiLanguage")).toBe("es");
  });

  it("an existing learner without a language gets the picker on the start page, until they choose", async () => {
    serveSettings({});
    fakeApi.on("GET", "/dashboard", {
      nextUnitId: null, lastLocation: null, dailyGoalMinutes: 30, minutesToday: 0, streak: { current: 0, best: 0 }, dueCount: 0, newCount: 0,
      modules: [], hardCount: 0, weakTags: [], backupReminder: { show: false, daysAgo: null, unsavedAnswers: 0 }, nextExam: null,
    });
    fakeApi.on("GET", "/course", { modules: [] });
    const { wrapper } = await mountApp(DashboardView, { language: "en" });
    await useSettingsStore().load();
    await flushPromises();
    expect(wrapper.find("[role=radiogroup]").exists()).toBe(true);

    await clickButton(wrapper, "Nederlands");
    expect(puts()).toEqual([{ language: "nl" }]);
    expect(wrapper.find("[role=radiogroup]").exists()).toBe(false);
  });

  it("starting from the welcome page keeps the preselected language, saved before the welcome is marked as seen", async () => {
    serveSettings({});
    fakeApi.on("POST", "/welcome/seen", { seen: true });
    fakeApi.on("GET", "/import/last", null);
    const { wrapper, router } = await mountApp(WelcomeView, { routePath: "/welkom", url: "/welkom", language: "es" });
    expect(wrapper.find("[role=radio][aria-checked=true]").text()).toBe("Español");

    await clickButton(wrapper, "Begin met leren");
    expect(puts()).toEqual([{ language: "es" }]);
    const order = fakeApi.calls.filter((c) => c.method !== "GET").map((c) => c.path);
    expect(order).toEqual(["/settings", "/welcome/seen"]);
    expect(router.currentRoute.value.path).toBe("/");
  });

  it("a language that cannot be saved is still used on this device", async () => {
    serveSettings({});
    fakeApi.fail("PUT", "/settings", "De opslag is vol.");
    const { wrapper } = await mountApp({ components: { LanguagePicker }, template: `<LanguagePicker />` });
    await useSettingsStore().load();
    await clickButton(wrapper, "Español");
    expect(wrapper.find("[role=radio][aria-checked=true]").text()).toBe("Español");
    expect(localStorage.getItem("uiLanguage")).toBe("es");
  });
});

describe("/?lang= from the landing pages", () => {
  const at = (href: string) => {
    const replaced: string[] = [];
    const history = { state: null, replaceState: (_: unknown, __: string, url: string) => replaced.push(url) } as unknown as History;
    takeLanguageParam({ href } as Location, history);
    return replaced;
  };
  afterEach(() => resetRequestedLanguage());

  it("preselects a supported language and takes the parameter out of the address, keeping the rest", () => {
    expect(at("https://example.org/?lang=es&x=1#top")).toEqual(["/?x=1#top"]);
    expect(requestedLanguage()).toBe("es");
  });

  it("ignores a language the app does not have yet, but still cleans the address", () => {
    expect(at("https://example.org/?lang=ti")).toEqual(["/"]);
    expect(requestedLanguage()).toBeNull();
  });

  it("leaves an address without the parameter alone", () => {
    expect(at("https://example.org/woorden?x=1")).toEqual([]);
  });

  it("is the first-visit choice, but a language the learner saved wins", async () => {
    at("https://example.org/?lang=es");
    localStorage.removeItem("uiLanguage");
    serveSettings({});
    const shown = { components: { LanguagePicker }, template: `<LanguagePicker />` };
    // no mountApp: it sets the remembered language, which would hide the parameter
    const { mount } = await import("@vue/test-utils");
    const { createPinia, setActivePinia } = await import("pinia");
    const pinia = createPinia();
    setActivePinia(pinia);
    const w = mount(shown, { global: { plugins: [pinia] }, attachTo: document.body });
    await flushPromises();
    expect(w.find("[role=radio][aria-checked=true]").text()).toBe("Español");

    serveSettings({ language: "en" });
    await useSettingsStore().load();
    await flushPromises();
    expect(w.find("[role=radio][aria-checked=true]").text()).toBe("English");
    w.unmount();
  });
});

describe("settings: how much Dutch", () => {
  async function openSettings(s: Settings) {
    serveSettings({ model: "m1", dailyGoalMinutes: 20, newCardsPerDay: 10, speechRate: 0.95, spellcheckWriting: false, soundEffects: true, voiceAnnouncements: true, lessonMusic: true, ...s });
    fakeApi.on("GET", "/flags", []);
    fakeApi.on("GET", "/import/last", null);
    const m = await mountApp(SettingsView);
    await flushPromises();
    return m.wrapper;
  }

  it("choosing a level saves it and the page follows straight away", async () => {
    const w = await openSettings({ language: "en", immersion: 1 });
    await clickButton(w, "Dutch only");
    expect(puts()).toContainEqual({ immersion: 2 });
    expect(w.find("[aria-labelledby=immersion-title] [aria-checked=true]").text()).toContain("Alleen Nederlands");
  });

  it("feedback in my language can be switched on here", async () => {
    const w = await openSettings({ language: "en", immersion: 1 });
    const box = w.findAll("input[type=checkbox]").find((c) => c.element.closest("label")!.textContent!.includes("Feedback in my language"))!;
    (box.element as HTMLInputElement).checked = true;
    await box.trigger("change");
    expect(puts()).toContainEqual({ feedbackInMyLanguage: true });
  });

  it("is not offered when the language is Dutch", async () => {
    const w = await openSettings({ language: "nl" });
    expect(w.text()).not.toContain("Hoeveel Nederlands?");
  });
});

describe("feedback is Dutch first", () => {
  const mc = { id: "q-1", tags: [], prompt: "Vraag", explanation: "Uitleg bij de vraag.", difficulty: 1, type: "mc", options: ["goed", "fout"], answer: 0 };
  async function answered(s: Settings) {
    fakeApi.on("POST", "/attempts", {});
    serveSettings({ language: "en", immersion: 1, ...s });
    const m = await mountApp(ExerciseShell, { props: { exercise: mc } });
    await useSettingsStore().load();
    await flushPromises();
    await m.wrapper.findAll("button").find((b) => b.text().replace(/^\d/, "") === "fout")!.trigger("click");
    // "Controleer", or "Check" at level 0
    await m.wrapper.findAll("button").find((b) => /Controleer|^Check$/.test(b.text()))!.trigger("click");
    await flushPromises();
    return m.wrapper;
  }
  const status = (w: VueWrapper) => w.find("[role=status]");

  it("shows Dutch feedback even when the rest of the app is in English", async () => {
    const w = await answered({ immersion: 0 });
    expect(status(w).text()).toContain("Bijna. Het goede antwoord is:");
    expect(status(w).text()).not.toContain("Almost");
  });

  it("'In mijn taal' switches it to English and remembers that; the course explanation stays Dutch", async () => {
    const w = await answered({});
    await clickButton(w, "In mijn taal");
    expect(puts()).toEqual([{ feedbackInMyLanguage: true }]);
    expect(status(w).text()).toContain("Almost. The right answer is:");
    expect(status(w).text()).toContain("Uitleg bij de vraag.");

    await clickButton(w, "In het Nederlands");
    expect(status(w).text()).toContain("Bijna. Het goede antwoord is:");
  });

  it("switching language translates the same praise instead of picking another one", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // praise 1 of 0..2
    fakeApi.on("POST", "/attempts", {});
    serveSettings({ language: "en" });
    const m = await mountApp(ExerciseShell, { props: { exercise: mc } });
    await useSettingsStore().load();
    await m.wrapper.findAll("button").find((b) => b.text().replace(/^\d/, "") === "goed")!.trigger("click");
    await clickButton(m.wrapper, "Controleer");
    expect(status(m.wrapper).text()).toContain("Helemaal goed.");
    vi.spyOn(Math, "random").mockReturnValue(0);
    await clickButton(m.wrapper, "In mijn taal");
    expect(status(m.wrapper).text()).toContain("Completely right.");
    vi.restoreAllMocks();
  });

  it("there is no language switch for a Dutch learner", async () => {
    const w = await answered({ language: "nl" });
    expect(buttonWith(w, "In mijn taal")).toBeUndefined();
  });

  it("a switch that cannot be saved keeps the feedback as it was", async () => {
    serveSettings({ language: "en" });
    fakeApi.fail("PUT", "/settings", "De opslag is vol.");
    const { wrapper } = await mountApp({ components: { FeedbackLanguageToggle }, template: `<FeedbackLanguageToggle />` });
    await useSettingsStore().load();
    await clickButton(wrapper, "In mijn taal");
    expect(buttonWith(wrapper, "In mijn taal")!.attributes("aria-pressed")).toBe("false");
  });
});

describe("Unit 0: the app's own words", () => {
  const blocks = [{ kind: "vocab", ids: ["basis-vocab-app-001"] }];
  async function lesson(s: Settings) {
    serveSettings(s);
    fakeApi.on("GET", "/vocab", [{ theme: "app", title: "De woorden van de app", entries: [{ id: "basis-vocab-app-001", nl: "volgende", definitionNl: "Wat na dit komt.", example: "Klik op Volgende.", state: "new" }] }]);
    const m = await mountApp(LessonBlocks, { props: { blocks } });
    await useSettingsStore().load();
    await flushPromises();
    return m.wrapper;
  }

  it("a word card shows the word in the learner's language, from the app's own text", async () => {
    const w = await lesson({ language: "es", immersion: 1 });
    expect(w.text()).toContain("siguiente");
  });

  it("from level 2 the card is Dutch only", async () => {
    const w = await lesson({ language: "es", immersion: 2 });
    expect(w.text()).toContain("Wat na dit komt.");
    expect(w.text()).not.toContain("siguiente");
  });
});

describe("text with **bold** (UiText md)", () => {
  it("shows bold, but a value put into the message stays text", async () => {
    serveSettings({ language: "en", immersion: 1 });
    const { wrapper } = await mountApp(UiText, { props: { k: "common.score", md: true, params: { good: "<img src=x onerror=alert(1)>", total: 5 } } });
    await useSettingsStore().load();
    await flushPromises();
    expect(wrapper.find("strong").exists()).toBe(true);
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain("<img src=x onerror=alert(1)>");
  });
});
