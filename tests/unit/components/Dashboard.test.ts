// @vitest-environment jsdom
// The start page and the module page: where "continue" leads and what is recommended next.
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../src/App.vue";
import DashboardView from "../../../src/views/DashboardView.vue";
import ModuleView from "../../../src/views/ModuleView.vue";
import { clickButton, fakeApi, flushPromises, mountApp } from "../../helpers/component";
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
  hardCount: 0, weakTags: [], backupReminder: { show: false, daysAgo: null, unsavedAnswers: 0 }, nextExam: null, studyPlan: null, ...extra,
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

describe("study plan on the dashboard", () => {
  const open = (d: unknown) => {
    fakeApi.on("GET", "/dashboard", d);
    return mountApp(DashboardView, { routePath: "/", url: "/" });
  };
  const lesson = (id: string, title: string, minutes = 15) => ({ kind: "lesson", id, title, moduleId: id.split("-")[0], minutes, day: "2026-10-29" });
  const studyPlan = (extra: Record<string, unknown> = {}) => ({
    today: "2026-10-28",
    exams: [
      { skill: "knm", date: "2026-11-12", daysLeft: 15, lessonsLeft: 3, mockExamsLeft: 1 },
      { skill: "lezen", date: "2026-12-03", daysLeft: 36, lessonsLeft: 1, mockExamsLeft: 2 },
    ],
    minutesPerDay: 20,
    weeks: [
      { start: "2026-10-28", end: "2026-11-03", tasks: [lesson("basis-a", "Les A"), { kind: "exam", id: "exam-knm-1", title: "Proefexamen KNM 1", moduleId: "knm", minutes: 45, day: "2026-11-01" }], exams: [] },
      { start: "2026-11-04", end: "2026-11-10", tasks: [lesson("knm-wonen", "Wonen")], exams: [] },
      { start: "2026-11-11", end: "2026-11-17", tasks: [lesson("lezen-brief", "Brieven lezen")], exams: ["knm"] },
    ],
    ...extra,
  });
  const card = (w: any) => w.find("section[aria-label='Studieplan']");

  it("without an exam date the learner is invited to fill one in at Instellingen", async () => {
    const { wrapper } = await open(dashboard());
    expect(card(wrapper).text()).toContain("Wanneer is je examen?");
    expect(card(wrapper).find("a").attributes("href")).toBe("/instellingen");
  });

  it("shows each exam with its date, the days left and what is still to do, in words that fit the number", async () => {
    const { wrapper } = await open(dashboard({ studyPlan: studyPlan() }));
    const exams = card(wrapper).findAll("ul")[0].findAll("li").map((li: any) => li.text());
    expect(exams[0]).toContain("KNM · donderdag 12 november");
    expect(exams[0]).toContain("Nog 15 dagen · Nog te doen: 3 lessen en 1 proefexamen");
    expect(exams[1]).toContain("Lezen A2 · donderdag 3 december");
    expect(exams[1]).toContain("Nog te doen: 1 les en 2 proefexamens");
    expect(wrapper.text()).not.toContain("Wanneer is je examen?");
  });

  it("this week's lessons lead to the lesson and a mock exam leads to the exams page; later weeks are folded away", async () => {
    const { wrapper } = await open(dashboard({ studyPlan: studyPlan() }));
    expect(card(wrapper).text()).toContain("Deze week (28 okt – 3 nov)");
    expect(card(wrapper).find("a[href='/unit/basis-a']").text()).toContain("Les A");
    expect(card(wrapper).find("a[href='/examens']").text()).toContain("Proefexamen KNM 1");
    const later = card(wrapper).find("details");
    expect(later.text()).toContain("Volgende week (4 nov – 10 nov)");
    expect(later.text()).toContain("Wonen");
    expect(later.text()).toContain("11 nov – 17 nov");
    expect(later.text()).toContain("Examen KNM");
    expect(card(wrapper).find("a[href='/unit/knm-wonen']").exists()).toBe(false);
  });

  it("when this week has nothing planned, the first week shown is not called 'Deze week'", async () => {
    const plan = studyPlan();
    const { wrapper } = await open(dashboard({ studyPlan: { ...plan, weeks: plan.weeks.slice(2) } }));
    expect(card(wrapper).find("h3").text()).toBe("11 nov – 17 nov");
    expect(card(wrapper).find("details").exists()).toBe(false);
  });

  it("warns when the plan needs more minutes a day than the learner's goal, and not when it is exactly the goal", async () => {
    const over = await open(dashboard({ dailyGoalMinutes: 19, studyPlan: studyPlan() }));
    expect(card(over.wrapper).text()).toContain("Leer ongeveer 20 minuten per dag");
    expect(card(over.wrapper).text()).toContain("Dat is meer dan je doel van 19 minuten.");
    const exact = await open(dashboard({ dailyGoalMinutes: 20, studyPlan: studyPlan() }));
    expect(card(exact.wrapper).text()).not.toContain("meer dan je doel");
  });

  it("an exam today or tomorrow is called that, and with nothing left to do the learner hears they are ready", async () => {
    const { wrapper } = await open(dashboard({ studyPlan: studyPlan({
      minutesPerDay: 0,
      exams: [
        { skill: "knm", date: "2026-10-28", daysLeft: 0, lessonsLeft: 0, mockExamsLeft: 0 },
        { skill: "schrijven", date: "2026-10-29", daysLeft: 1, lessonsLeft: 2, mockExamsLeft: 0 },
      ],
      weeks: [{ start: "2026-10-28", end: "2026-11-03", tasks: [], exams: ["knm", "schrijven"] }],
    }) }));
    const exams = card(wrapper).findAll("ul")[0].findAll("li").map((li: any) => li.text());
    expect(exams[0]).toContain("Vandaag! Succes! · ✓ Alles gedaan.");
    expect(exams[1]).toContain("Morgen! · Nog te doen: 2 lessen");
    expect(card(wrapper).text()).not.toContain("minuten per dag");
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
