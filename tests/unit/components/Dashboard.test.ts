// @vitest-environment jsdom
// The start page and the module page: where "continue" leads and what is recommended next.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../src/App.vue";
import DashboardView from "../../../src/views/DashboardView.vue";
import ModuleView from "../../../src/views/ModuleView.vue";
import ModuleCards from "../../../src/components/ModuleCards.vue";
import { buttonWith, clickButton, deferred, fakeApi, flushPromises, mountApp } from "../../helpers/component";
import { useSessionStore } from "../../../src/stores/session";

const background = vi.hoisted(() => ({ ready: false }));
vi.mock("../../../src/lib/backgrounds", () => ({ pickBackground: () => "/bg-test.jpg", isBackgroundReady: () => background.ready }));

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const course = {
  id: "c", title: "Cursus",
  modules: [
    { id: "exams", title: "Proefexamens", description: "", icon: "", units: [] },
    { id: "basis", title: "Basis", description: "Eerste stappen", icon: "", units: [
      { id: "basis-a", title: "Les A", estimatedMinutes: 10, stepCount: 8 },
      { id: "basis-b", title: "Les B", estimatedMinutes: 12, stepCount: 9 },
      { id: "basis-c", title: "Les C", estimatedMinutes: 15, stepCount: 11 },
    ] },
  ],
};
const dashboard = (extra: Record<string, unknown> = {}) => ({
  nextUnitId: "basis-a", lastLocation: null, dailyGoalMinutes: 20, minutesToday: 5, streak: { current: 1, best: 4 }, dueCount: 3, newCount: 2,
  modules: [{ id: "basis", title: "Basis", total: 3, completed: 1 }, { id: "exams", title: "Proefexamens", total: 0, completed: 0 }],
  hardCount: 0, weakTags: [], backupReminder: { show: false, daysAgo: null, unsavedAnswers: 0 }, nextExam: null, ...extra,
});

beforeEach(() => {
  fakeApi.reset();
  background.ready = false;
  fakeApi.on("GET", "/course", course);
});

describe("DashboardView", () => {
  const open = (d: unknown) => {
    fakeApi.on("GET", "/dashboard", d);
    return mountApp(DashboardView, { routePath: "/", url: "/" });
  };

  it("a new learner is sent to the lesson the app names as next, not to one worked out from the course list", async () => {
    const { wrapper } = await open(dashboard({ nextUnitId: "basis-c" }));
    expect(wrapper.find("a[href='/unit/basis-c']").text()).toContain("Begin met leren");
    expect(wrapper.find("a[href='/unit/basis-a']").exists()).toBe(false);
    expect(wrapper.text()).toContain("Klaar om te leren?");
  });

  it("no lesson to start and nowhere to continue: no start button, but reviewing words is still offered", async () => {
    const { wrapper } = await open(dashboard({ nextUnitId: null }));
    expect(wrapper.text()).not.toContain("Begin met leren");
    expect(wrapper.text()).not.toContain("Verder waar ik was");
    expect(wrapper.find("a[href='/woorden/herhalen']").exists()).toBe(true);
  });

  it("the background fades in once it has loaded", async () => {
    const { wrapper } = await open(dashboard());
    const img = wrapper.find("img");
    expect(img.attributes("src")).toBe("/bg-test.jpg");
    expect(img.classes()).toContain("opacity-0");
    await img.trigger("load");
    expect(img.classes()).toContain("opacity-100");
    expect(img.classes()).not.toContain("opacity-0");
  });

  it("a background that was preloaded is visible at once, without a blank moment", async () => {
    background.ready = true;
    const { wrapper } = await open(dashboard());
    expect(wrapper.find("img").classes()).toContain("opacity-100");
  });

  it("someone who was in the middle of a lesson is sent back to that lesson, not to the next new one", async () => {
    const { wrapper } = await open(dashboard({ nextUnitId: "basis-c", lastLocation: { unitId: "basis-b", unitTitle: "Les B", stepIndex: 3, stepCount: 9 } }));
    expect(wrapper.find("a[href='/unit/basis-b']").text()).toContain("Verder waar ik was");
    expect(wrapper.text()).toContain("Je was bezig met: Les B.");
    expect(wrapper.find("a[href='/unit/basis-c']").exists()).toBe(false);
  });

  it("the review button counts due and new cards together", async () => {
    const { wrapper } = await open(dashboard());
    expect(wrapper.find("a[href='/woorden/herhalen']").text()).toContain("(5)");
  });

  it("with no words due and none new, the review button is left out", async () => {
    const { wrapper } = await open(dashboard({ dueCount: 0, newCount: 0 }));
    expect(wrapper.find("a[href='/woorden/herhalen']").exists()).toBe(false);
    const onlyNew = await open(dashboard({ dueCount: 0, newCount: 4 }));
    expect(onlyNew.wrapper.find("a[href='/woorden/herhalen']").text()).toContain("(4)");
  });

  it("modules show their progress; the exam module has no lesson count", async () => {
    const { wrapper } = await open(dashboard());
    expect(wrapper.find("a[href='/module/basis']").text()).toContain("1 van 3 lessen klaar");
    expect(wrapper.find("a[href='/module/exams']").text()).toContain("Oefen onder examentijd");
  });

  it("the goal gauge shows today's minutes against the learner's own daily goal", async () => {
    const { wrapper } = await open(dashboard({ minutesToday: 7.6, dailyGoalMinutes: 45 }));
    expect(wrapper.find("section[aria-label='Vandaag'] [role=img]").attributes("aria-label")).toBe("8 van 45 minuten");
  });

  it("one day is 'dag', several are 'dagen'", async () => {
    const one = await open(dashboard({ streak: { current: 1, best: 1 } }));
    expect(one.wrapper.text()).toMatch(/1\s*dag(?!en)/);
    const many = await open(dashboard({ streak: { current: 6, best: 9 } }));
    expect(many.wrapper.text()).toMatch(/6\s*dagen/);
  });

  it("the reminder to save progress only appears when it is due, and opens the finish dialog", async () => {
    const none = await open(dashboard());
    expect(none.wrapper.text()).not.toContain("Bewaar je voortgang");
    const { wrapper, pinia } = await open(dashboard({ backupReminder: { show: true, daysAgo: 9, unsavedAnswers: 40 } }));
    expect(wrapper.text()).toContain("Laatst bewaard: 9 dagen geleden.");
    await clickButton(wrapper, "Bewaar nu");
    expect(useSessionStore(pinia).finishOpen).toBe(true);
    const never = await open(dashboard({ backupReminder: { show: true, daysAgo: null, unsavedAnswers: 3 } }));
    expect(never.wrapper.text()).toContain("Je hebt je voortgang nog niet bewaard.");
  });

  it("weak topics link to practice; the Claude button is left out for writing mistakes (there is nothing to generate)", async () => {
    const { wrapper } = await open(dashboard({
      weakTags: [{ tag: "grammar:de-het", accuracy: 0.4, seen: 10 }, { tag: "writing:werkwoordsvorm", accuracy: 0.2, seen: 5 }],
      hardCount: 2,
    }));
    expect(wrapper.text()).toContain("grammar · de-het");
    expect(wrapper.text()).toContain("40% goed (10 antwoorden)");
    expect(wrapper.text()).toContain("Schrijffout: werkwoordsvorm");
    const practice = wrapper.findAll("a").map((a) => decodeURIComponent(a.attributes("href") ?? "")).filter((h) => h.startsWith("/oefenen"));
    expect(practice).toEqual([
      "/oefenen?tag=grammar:de-het",
      "/oefenen?gen=tag&tag=grammar:de-het",
      "/oefenen?tag=writing:werkwoordsvorm", // no "Meer met Claude" for this one
      "/oefenen?mode=hard",
    ]);
    expect(wrapper.text()).toContain("2 moeilijke vragen");
  });

  it("without weak points a friendly note says how to get them, in one sentence", async () => {
    const { wrapper } = await open(dashboard());
    const note = wrapper.findAll("section").find((s) => s.text().includes("Dit moet je meer oefenen"))!;
    expect(note.find("p").text()).toBe("Doe een paar lessen, dan zie je hier wat beter kan.");
  });

  it("a load error is shown", async () => {
    fakeApi.fail("GET", "/dashboard", "Database niet beschikbaar.");
    const { wrapper } = await mountApp(DashboardView, { routePath: "/", url: "/" });
    expect(wrapper.text()).toContain("Database niet beschikbaar.");
  });
});

describe("putting the modules in your own order", () => {
  const three = [
    { id: "basis", title: "Basis", total: 3, completed: 1 },
    { id: "knm", title: "KNM", total: 2, completed: 0 },
    { id: "exams", title: "Proefexamens", total: 0, completed: 0 },
  ];
  const open = () => {
    fakeApi.on("GET", "/dashboard", dashboard({ modules: three }));
    fakeApi.on("PUT", "/settings", (body) => ({ apiKey: null, ...(body as object) }));
    return mountApp(DashboardView, { routePath: "/", url: "/" });
  };
  const titles = (w: any) => w.findAll("[data-module-id] h3").map((h: any) => h.text());
  const card = (w: any, id: string) => w.find(`[data-module-id='${id}']`);
  const handle = (w: any, id: string) => card(w, id).find("[data-handle]");
  const saved = () => fakeApi.to("PUT", "/settings").map((c) => (c.body as { moduleOrder: string[] }).moduleOrder);
  const pointer = (type: string, target: EventTarget, at: { x?: number; y?: number } = {}) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: at.x ?? 100, clientY: at.y ?? 300 }));
  // jsdom has no layout: say which card is under the finger.
  let under: Element | null = null;
  beforeEach(() => {
    under = null;
    document.elementFromPoint = vi.fn(() => under);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("without edit mode there are no drag handles and a card opens its module", async () => {
    const { wrapper, router } = await open();
    expect(wrapper.find("[data-handle]").exists()).toBe(false);
    await card(wrapper, "knm").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/module/knm");
  });

  it("the edit button shows a handle on every card; in edit mode a card does not open, and 'Klaar' ends it", async () => {
    const { wrapper, router } = await open();
    await clickButton(wrapper, "Volgorde aanpassen");
    expect(wrapper.findAll("[data-handle]").map((h) => h.attributes("aria-label"))).toEqual(["Verplaats Basis", "Verplaats KNM", "Verplaats Proefexamens"]);
    await card(wrapper, "knm").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/");
    await clickButton(wrapper, "Klaar");
    expect(wrapper.find("[data-handle]").exists()).toBe(false);
    await card(wrapper, "knm").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/module/knm");
  });

  it("dragging a card by its handle onto another place moves it there and saves the new order once", async () => {
    const { wrapper } = await open();
    await clickButton(wrapper, "Volgorde aanpassen");
    pointer("pointerdown", handle(wrapper, "exams").element);
    under = card(wrapper, "knm").element;
    pointer("pointermove", window);
    under = card(wrapper, "basis").element.querySelector("h3");
    pointer("pointermove", window);
    await flushPromises();
    expect(titles(wrapper)).toEqual(["Proefexamens", "Basis", "KNM"]);
    expect(saved()).toEqual([]); // not while the finger is still down
    pointer("pointerup", window);
    await flushPromises();
    expect(saved()).toEqual([["exams", "basis", "knm"]]);
    expect(wrapper.find("[role=status]").text()).toBe("Proefexamens staat nu op plek 1 van 3.");
  });

  it("a drag that ends where it started saves nothing", async () => {
    const { wrapper } = await open();
    await clickButton(wrapper, "Volgorde aanpassen");
    pointer("pointerdown", handle(wrapper, "basis").element);
    under = card(wrapper, "knm").element;
    pointer("pointermove", window);
    // Back up: KNM now sits in the first place, where Basis was.
    pointer("pointermove", window);
    pointer("pointerup", window);
    await flushPromises();
    expect(titles(wrapper)).toEqual(["Basis", "KNM", "Proefexamens"]);
    expect(saved()).toEqual([]);
  });

  it("a finger resting near the top edge keeps scrolling the page up, until it is lifted", async () => {
    const { wrapper } = await open();
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy;
    await clickButton(wrapper, "Volgorde aanpassen");
    pointer("pointerdown", handle(wrapper, "exams").element);
    pointer("pointermove", window, { y: 10 });
    await vi.advanceTimersByTimeAsync(200);
    expect(scrollBy.mock.calls.length).toBeGreaterThan(5);
    expect(scrollBy).toHaveBeenLastCalledWith(0, -12);
    pointer("pointerup", window);
    scrollBy.mockClear();
    await vi.advanceTimersByTimeAsync(200);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("the arrow keys on a handle move the card one place and keep the focus on it; past the end nothing happens", async () => {
    const { wrapper } = await open();
    await clickButton(wrapper, "Volgorde aanpassen");
    (handle(wrapper, "basis").element as HTMLElement).focus();
    await handle(wrapper, "basis").trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(titles(wrapper)).toEqual(["KNM", "Basis", "Proefexamens"]);
    expect(document.activeElement).toBe(handle(wrapper, "basis").element);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handle(wrapper, "knm").trigger("keydown", { key: "ArrowUp" }); // already first
    await handle(wrapper, "exams").trigger("keydown", { key: "ArrowDown" }); // already last
    await flushPromises();
    expect([...errors.mock.calls, ...warnings.mock.calls]).toEqual([]);
    errors.mockRestore();
    warnings.mockRestore();
    expect(saved()).toEqual([["knm", "basis", "exams"]]);
  });

  it("holding a card opens edit mode, and the same finger can drag it right away", async () => {
    const { wrapper, router } = await open();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    pointer("pointerdown", card(wrapper, "exams").find("h3").element);
    await vi.advanceTimersByTimeAsync(599);
    expect(wrapper.find("[data-handle]").exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.find("[data-handle]").exists()).toBe(true);
    under = card(wrapper, "basis").element;
    pointer("pointermove", window);
    pointer("pointerup", window);
    // The release after a hold is not a tap that opens the module.
    await card(wrapper, "basis").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/");
    expect(saved()).toEqual([["exams", "basis", "knm"]]);
  });

  it("a short tap or a finger that scrolls does not start edit mode", async () => {
    const { wrapper } = await open();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    pointer("pointerdown", card(wrapper, "knm").element);
    pointer("pointerup", window);
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.find("[data-handle]").exists()).toBe(false);
    pointer("pointerdown", card(wrapper, "knm").element, { y: 300 });
    pointer("pointermove", window, { y: 330 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.find("[data-handle]").exists()).toBe(false);
  });

  it("the phone's long-press menu is replaced by edit mode", async () => {
    const { wrapper } = await open();
    pointer("pointerdown", card(wrapper, "knm").element);
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    card(wrapper, "knm").element.dispatchEvent(menu);
    await flushPromises();
    expect(menu.defaultPrevented).toBe(true);
    expect(wrapper.find("[data-handle]").exists()).toBe(true);
  });

  it("when saving fails the learner is told, the new order stays on screen, and the next move clears the message", async () => {
    const { wrapper } = await open();
    fakeApi.fail("PUT", "/settings", "Database niet beschikbaar.");
    await clickButton(wrapper, "Volgorde aanpassen");
    await handle(wrapper, "basis").trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(wrapper.find("[role=alert]").text()).toBe("De volgorde is niet bewaard. Probeer het nog een keer.");
    expect(titles(wrapper)).toEqual(["KNM", "Basis", "Proefexamens"]);
    fakeApi.on("PUT", "/settings", {});
    await handle(wrapper, "basis").trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(wrapper.find("[role=alert]").exists()).toBe(false);
    expect(saved().at(-1)).toEqual(["knm", "exams", "basis"]);
  });

  it("two quick moves are saved one after the other, so the last order wins", async () => {
    const { wrapper } = await open();
    const first = deferred();
    fakeApi.on("PUT", "/settings", () => first.promise);
    await clickButton(wrapper, "Volgorde aanpassen");
    await handle(wrapper, "basis").trigger("keydown", { key: "ArrowDown" });
    await handle(wrapper, "basis").trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(saved()).toEqual([["knm", "basis", "exams"]]);
    fakeApi.on("PUT", "/settings", {});
    first.resolve({});
    await flushPromises();
    expect(saved()).toEqual([["knm", "basis", "exams"], ["knm", "exams", "basis"]]);
  });

  it("leaving the page during a hold or a drag leaves nothing running", async () => {
    const { wrapper } = await open();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    pointer("pointerdown", card(wrapper, "knm").element);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(1000);
    pointer("pointermove", window);
    pointer("pointerup", window);
    expect(document.elementFromPoint).not.toHaveBeenCalled();

    const again = await open();
    await clickButton(again.wrapper, "Volgorde aanpassen");
    pointer("pointerdown", handle(again.wrapper, "basis").element);
    again.wrapper.unmount();
    pointer("pointermove", window);
    pointer("pointerup", window);
    await flushPromises();
    expect(document.elementFromPoint).not.toHaveBeenCalled();
    expect(saved()).toEqual([]);
  });

  it("shows the modules in the order the app gives them", async () => {
    const { wrapper } = await mountApp(ModuleCards, { props: { modules: [three[2], three[0], three[1]] } });
    expect(titles(wrapper)).toEqual(["Proefexamens", "Basis", "KNM"]);
  });
});

describe("review badge in the phone top bar", () => {
  // The real app shell around the real dashboard: the count travels from one to the other.
  const openApp = (d: unknown) => {
    fakeApi.on("GET", "/dashboard", d);
    fakeApi.on("GET", "/settings", { apiKey: null, theme: "system" });
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
    const routes = [
      { path: "/", component: DashboardView },
      { path: "/woorden/herhalen", component: { template: "<p>herhalen</p>" } },
    ];
    return mountApp(App, { routes, url: "/", stubs: { FinishSessionDialog: true } });
  };
  const badge = (w: any) => w.find("header a[href='/woorden/herhalen']");

  it("shows the number of words to review and leads to the review; the page itself has no badge", async () => {
    const { wrapper, router } = await openApp(dashboard({ dueCount: 3, newCount: 2 }));
    expect(badge(wrapper).text()).toBe("📕5");
    expect(badge(wrapper).attributes("aria-label")).toBe("Woorden herhalen (5)");
    await badge(wrapper).trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/woorden/herhalen");
    expect(badge(wrapper).exists()).toBe(false);
  });

  it("with nothing to review there is no badge", async () => {
    const { wrapper } = await openApp(dashboard({ dueCount: 0, newCount: 0 }));
    expect(badge(wrapper).exists()).toBe(false);
  });
});

describe("ModuleView", () => {
  const open = (progressUnits: Record<string, unknown>, id = "basis") => {
    fakeApi.on("GET", "/progress", { units: progressUnits, items: {} });
    return mountApp(ModuleView, { routePath: "/module/:id", url: `/module/${id}` });
  };

  it("recommends the first lesson that is not finished", async () => {
    const { wrapper } = await open({ "basis-a": { status: "completed", stepIndex: 7, bestScore: 0.9 }, "basis-b": { status: "in_progress", stepIndex: 2 } });
    const rows = wrapper.findAll("ol > li");
    expect(rows[0].text()).not.toContain("Volgende");
    expect(rows[1].text()).toContain("Volgende");
    expect(rows[2].text()).not.toContain("Volgende");
  });

  it("shows best score for finished lessons and the step for lessons in progress", async () => {
    const { wrapper } = await open({ "basis-a": { status: "completed", stepIndex: 7, bestScore: 0.86 }, "basis-b": { status: "in_progress", stepIndex: 2 } });
    const rows = wrapper.findAll("ol > li").map((r) => r.text());
    expect(rows[0]).toContain("beste score 86%");
    expect(rows[0]).toContain("✓");
    expect(rows[1]).toContain("bezig (stap 3)");
    expect(rows[2]).toContain("15 min · 11 stappen");
  });

  it("when everything is finished nothing is recommended", async () => {
    const done = { status: "completed", stepIndex: 1, bestScore: 1 };
    const { wrapper } = await open({ "basis-a": done, "basis-b": done, "basis-c": done });
    expect(wrapper.text()).not.toContain("Volgende");
  });

  it("a module without lessons says lessons are coming", async () => {
    const { wrapper } = await open({}, "exams");
    expect(wrapper.text()).toContain("Hier komen later lessen.");
  });

  it("only the writing module links to 'Mijn teksten en feedback'", async () => {
    fakeApi.on("GET", "/course", { ...course, modules: [...course.modules, { id: "schrijven", title: "Schrijven", description: "", icon: "", units: [] }] });
    const writing = await open({}, "schrijven");
    expect(writing.wrapper.find("a[href='/schrijven/geschiedenis']").exists()).toBe(true);
    const basis = await open({});
    expect(basis.wrapper.find("a[href='/schrijven/geschiedenis']").exists()).toBe(false);
  });
});
